import { describe, expect, it } from "vitest";
import { JUDGE_EXPIRES_MS, REDEEM_CAP, redeemJudgeCode } from "@/lib/payments/redeem";
import { freshLocalEnv } from "@/lib/server/local";
import { createSession, loadUserState, requireUser, userIdFromRequest } from "@/lib/server/session";

const CODE = "SETTLA-JUDGE-TEST-1234";

describe("judge code redemption", () => {
  it("upgrades to the judge plan once per user", async () => {
    const env = freshLocalEnv({ JUDGE_CODE: CODE });
    const plan = await redeemJudgeCode(env, "u1", " settla-judge-test-1234 ");
    expect(plan.kind).toBe("judge");
    expect(plan.expiresAt).toBe(new Date(JUDGE_EXPIRES_MS).toISOString());
    await expect(redeemJudgeCode(env, "u1", CODE)).rejects.toMatchObject({ code: "already_redeemed" });
  });

  it("rejects wrong codes and an unset code", async () => {
    await expect(redeemJudgeCode(freshLocalEnv({ JUDGE_CODE: CODE }), "u1", "nope")).rejects.toMatchObject({ code: "invalid_code" });
    await expect(redeemJudgeCode(freshLocalEnv({ JUDGE_CODE: "" }), "u1", "")).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("rejects after 2026-12-16", async () => {
    await expect(redeemJudgeCode(freshLocalEnv({ JUDGE_CODE: CODE }), "u1", CODE, JUDGE_EXPIRES_MS + 1)).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("stops at the 200-redemption cap", async () => {
    const env = freshLocalEnv({ JUDGE_CODE: CODE });
    for (let i = 0; i < REDEEM_CAP; i++) await redeemJudgeCode(env, `u${i}`, CODE);
    await expect(redeemJudgeCode(env, "one-too-many", CODE)).rejects.toMatchObject({ code: "code_exhausted" });
    expect((await loadUserState(env, "one-too-many"))?.plan.kind).toBe("free");
  });
});

describe("session cookie", () => {
  it("round-trips, and rejects forged cookies", async () => {
    const { userId, cookie } = await createSession();
    expect(cookie).toMatch(/^settla_uid=.+; Path=\/; HttpOnly; SameSite=Lax/);
    const value = cookie.split(";")[0];
    const ok = await requireUser(new Request("http://x", { headers: { cookie: value } }));
    expect(ok.userId).toBe(userId);
    expect(ok.plan.kind).toBe("free");
    const forged = value.replace(userId, "u_attacker");
    await expect(requireUser(new Request("http://x", { headers: { cookie: forged } }))).rejects.toMatchObject({ status: 401 });
    expect(await userIdFromRequest(new Request("http://x"), freshLocalEnv())).toBeNull();
  });
});
