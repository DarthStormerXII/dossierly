import { describe, expect, it } from "vitest";
import { applyWebhookEvent } from "@/lib/payments/grants";
import { verifyWebhook } from "@/lib/payments/webhook";
import { freshLocalEnv } from "@/lib/server/local";
import { loadUserState, ensureUser } from "@/lib/server/session";
import { hmacSha256 } from "@/lib/server/util";

const secretBytes = new TextEncoder().encode("settla-test-secret-32-bytes-long!!");
const KEY = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
const NOW = 1_800_000_000_000;

async function sign(id: string, ts: string, body: string) {
  const sig = await hmacSha256(secretBytes, `${id}.${ts}.${body}`);
  return `v1,${btoa(String.fromCharCode(...sig))}`;
}

describe("Dodo webhook verification", () => {
  const body = JSON.stringify({ type: "payment.succeeded", data: {} });
  const ts = String(NOW / 1000);

  it("accepts a valid signature (also among several)", async () => {
    const good = await sign("msg_1", ts, body);
    expect(await verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: good }, KEY, NOW)).toEqual({ ok: true });
    expect((await verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: `v1,AAAA ${good}` }, KEY, NOW)).ok).toBe(true);
  });

  it("rejects a tampered body, id or key", async () => {
    const good = await sign("msg_1", ts, body);
    expect(await verifyWebhook(body + " ", { id: "msg_1", timestamp: ts, signature: good }, KEY, NOW)).toMatchObject({ ok: false, reason: "bad_signature" });
    expect(await verifyWebhook(body, { id: "msg_2", timestamp: ts, signature: good }, KEY, NOW)).toMatchObject({ ok: false });
    expect(await verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: good }, "whsec_AAAA", NOW)).toMatchObject({ ok: false });
  });

  it("rejects stale and future timestamps", async () => {
    const old = String(NOW / 1000 - 301);
    expect(await verifyWebhook(body, { id: "m", timestamp: old, signature: await sign("m", old, body) }, KEY, NOW)).toMatchObject({ reason: "stale" });
    const future = String(NOW / 1000 + 301);
    expect(await verifyWebhook(body, { id: "m", timestamp: future, signature: await sign("m", future, body) }, KEY, NOW)).toMatchObject({ reason: "stale" });
  });

  it("rejects missing headers and missing key", async () => {
    expect(await verifyWebhook(body, { id: null, timestamp: ts, signature: "v1,x" }, KEY, NOW)).toMatchObject({ reason: "missing_headers" });
    expect(await verifyWebhook(body, { id: "m", timestamp: ts, signature: "v1,x" }, "", NOW)).toMatchObject({ reason: "no_key" });
  });
});

describe("entitlement grants", () => {
  const ev = (product: string, paymentId: string) => ({
    type: "payment.succeeded",
    data: { payment_id: paymentId, total_amount: 14900, currency: "PLN", metadata: { userId: "u_buyer", product } },
  });

  it("grants a case pass for 18 months, idempotent on webhook-id", async () => {
    const env = freshLocalEnv();
    await ensureUser(env, "u_buyer");
    expect(await applyWebhookEvent(env, "wh_1", ev("case_pass", "pay_1"))).toBe("granted");
    expect(await applyWebhookEvent(env, "wh_1", ev("case_pass", "pay_1"))).toBe("duplicate");
    expect(await applyWebhookEvent(env, "wh_other", ev("case_pass", "pay_1"))).toBe("duplicate");
    const s = await loadUserState(env, "u_buyer");
    expect(s?.plan.kind).toBe("case_pass");
    const months = (Date.parse(s!.plan.expiresAt!) - Date.now()) / (30 * 86400_000);
    expect(months).toBeGreaterThan(17.5);
    expect(months).toBeLessThan(18.5);
  });

  it("adds credits and ignores non-payment events", async () => {
    const env = freshLocalEnv();
    expect(await applyWebhookEvent(env, "wh_a", ev("credits_10", "pay_a"))).toBe("granted");
    expect(await applyWebhookEvent(env, "wh_b", ev("credits_25", "pay_b"))).toBe("granted");
    expect(await applyWebhookEvent(env, "wh_c", { type: "payment.failed", data: { payment_id: "pay_c", metadata: { userId: "u_buyer", product: "credits_10" } } })).toBe("ignored");
    expect((await loadUserState(env, "u_buyer"))?.plan.creditsLeft).toBe(35);
  });
});
