import { describe, expect, it, vi } from "vitest";
import { FALLBACK_AFTER_MS, STALE_CLAIM_MS, claimNextTask, enqueueAgentTask, getTask, taskView } from "@/lib/agent/queue";
import { acceptBridgeResult, acceptEgress, advanceTask } from "@/lib/agent/service";
import { listLedger } from "@/lib/server/ledger";
import { freshLocalEnv } from "@/lib/server/local";
import type { ChatClient } from "@/lib/model/types";
import { SAMPLE_USER_ID } from "@/lib/agent/schemas";

const CASE = {
  id: "case-1", office: "Mazowiecki Voivodeship Office, Warsaw", caseNumber: "WSC-II-P.6151.48213.2026",
  profile: { name: "Arjun Raman", language: "en" as const },
  events: [{ id: "e1", date: "2026-10-27", kind: "letter" as const, title: "Summons for health insurance proof", summary: "14 days from delivery" }],
  documents: [{ name: "Health insurance certificate", have: false }, { name: "Passport", have: true }],
  deadlines: [],
};
const PASSAGE = {
  url: "https://www.gov.pl/web/udsc/zezwolenie-na-pobyt-czasowy-i-prace",
  title: "Temporary residence and work permit",
  text: "The applicant must submit proof of health insurance or a document confirming payment of health insurance costs.",
};
const prepareInput = (extra = {}) => ({
  appointment: { office: CASE.office, purpose: "Submit missing documents", date: "2026-11-05" },
  case: CASE, language: "en", passages: [PASSAGE], ...extra,
});
const validPrepare = {
  checklist: [{ item: "Proof of health insurance", status: "missing", citation: { url: PASSAGE.url, title: PASSAGE.title, quote: "proof of health insurance or a document confirming payment" } }],
  phrases: [{ local: "Dzień dobry, przyszedłem złożyć brakujące dokumenty.", user: "Good day, I came to submit the missing documents." }],
  changes: [],
};

describe("agent queue", () => {
  it("claims the oldest queued task exactly once", async () => {
    const env = freshLocalEnv();
    const a = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    await new Promise((r) => setTimeout(r, 3));
    const b = await enqueueAgentTask(env, { userId: "u2", kind: "ask", input: { question: "When is my deadline?", case: CASE, language: "en" } });
    const [c1, c2, c3] = await Promise.all([claimNextTask(env), claimNextTask(env), claimNextTask(env)]);
    const ids = [c1, c2, c3].filter(Boolean).map((r) => r!.id).sort();
    expect(ids).toEqual([a.taskId, b.taskId].sort());
    expect(c1?.id).not.toBe(c2?.id);
    expect(c3).toBeNull();
    expect((await getTask(env, a.taskId))?.ran_on).toBe("sandbox");
  });

  it("rejects malformed input before queueing", async () => {
    const env = freshLocalEnv();
    await expect(enqueueAgentTask(env, { userId: "u", kind: "prepare", input: { case: CASE } })).rejects.toThrow();
    const { results } = await env.DB.prepare("SELECT id FROM tasks").all();
    expect(results).toHaveLength(0);
  });

  it("does not hand the bridge a task the cloud already took", async () => {
    const env = freshLocalEnv();
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    const row = (await getTask(env, taskId))!;
    const schedule = vi.fn();
    await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS, { schedule });
    expect(await claimNextTask(env)).toBeNull();
  });
});

describe("cloud fallback timing", () => {
  const fakeClient = (content: string): ChatClient => ({
    chat: vi.fn(async () => ({ content, usage: { tokensIn: 900, tokensOut: 300, cachedTokens: 0 } })),
  });

  it("leaves a fresh queued task alone, takes it over at 20 s", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    const row = (await getTask(env, taskId))!;
    const schedule = vi.fn();
    const early = await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS - 1, { schedule });
    expect(early.status).toBe("queued");
    expect(schedule).not.toHaveBeenCalled();
    const late = await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS, { schedule });
    expect(late.status).toBe("running");
    expect(late.ran_on).toBe("cloud");
    expect(schedule).toHaveBeenCalledTimes(1);
    // A second poll must not start a second cloud run.
    await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS + 500, { schedule });
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("runs the cloud model and stores a validated, cited result with ranOn cloud", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    const client = fakeClient(JSON.stringify(validPrepare));
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 25_000, { schedule: (w) => void jobs.push(w), client });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!);
    expect(view.status).toBe("done");
    expect(view.ranOn).toBe("cloud");
    expect((view as unknown as { result: typeof validPrepare }).result.checklist[0].citation.url).toBe(PASSAGE.url);
    expect((view as unknown as { run: { ranOn: string } }).run.ranOn).toBe("cloud");
    expect((await listLedger(env, "u1", 10)).entries[0].what).toContain("cloud fallback");
  });

  it("repairs a fabricated quote from the passage, takes status from the case and drops a citation outside the provided passages", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    const bad = {
      ...validPrepare,
      checklist: [
        { ...validPrepare.checklist[0], status: "have", citation: { ...validPrepare.checklist[0].citation, quote: "a sentence the source never says" } },
        { item: "Invented fee", status: "missing", citation: { url: "https://example.com/x", title: "x", quote: "pay 500 PLN" } },
      ],
    };
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 21_000, { schedule: (w) => void jobs.push(w), client: fakeClient(JSON.stringify(bad)) });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!) as unknown as { result: typeof validPrepare };
    expect(view.result.checklist).toHaveLength(1);
    // The model claimed "have"; the case lists the health insurance certificate as not held.
    expect(view.result.checklist[0].status).toBe("missing");
    expect(view.result.checklist[0].citation.quote.toLowerCase()).toContain("health insurance");
  });

  it("fails cleanly when the model never returns valid JSON", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "ask", input: { question: "Why?", case: CASE, language: "en" } });
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 30_000, { schedule: (w) => void jobs.push(w), client: fakeClient("sorry, no") });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!);
    expect(view.status).toBe("failed");
    expect(JSON.stringify(view)).not.toContain("sorry, no");
  });

  it("takes over a sandbox claim that went silent after 5 minutes", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "ask", input: { question: "Q", case: CASE, language: "en" } });
    const claimed = (await claimNextTask(env, 1_000_000))!;
    const schedule = vi.fn();
    expect((await advanceTask(env, claimed, 1_000_000 + STALE_CLAIM_MS - 1, { schedule })).ran_on).toBe("sandbox");
    expect((await advanceTask(env, claimed, 1_000_000 + STALE_CLAIM_MS, { schedule })).ran_on).toBe("cloud");
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(taskId).toBe(claimed.id);
  });
});

describe("bridge results and egress", () => {
  it("accepts a valid sandbox result once, with run and ledger entry", async () => {
    const env = freshLocalEnv();
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    await claimNextTask(env);
    const body = { taskId, ok: true, sandbox: "settla-pool-01", result: validPrepare, trace: [{ step: "agent worked", tool: "dcode", ms: 6200 }], durationMs: 6200, tokensIn: 1200, tokensOut: 400 };
    const first = await acceptBridgeResult(env, body as never);
    expect(first.accepted).toBe(true);
    expect((await acceptBridgeResult(env, body as never)).accepted).toBe(false);
    const view = taskView((await getTask(env, taskId))!) as unknown as { ranOn: string; sandbox: string; run: { ranOn: string }; trace: unknown[] };
    expect(view.ranOn).toBe("sandbox");
    expect(view.sandbox).toBe("settla-pool-01");
    expect(view.run.ranOn).toBe("sandbox");
    expect(view.trace.length).toBeGreaterThanOrEqual(2);
    expect((await listLedger(env, "u1", 5)).entries[0].what).toContain("private sandbox");
  });

  it("sends an invalid sandbox answer to the cloud instead of showing it", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() });
    await claimNextTask(env);
    const jobs: Array<() => Promise<unknown>> = [];
    const out = await acceptBridgeResult(env, { taskId, ok: true, sandbox: "s", result: { checklist: [] }, trace: [], durationMs: 5, tokensIn: 0, tokensOut: 0 }, { schedule: (w) => void jobs.push(w) });
    expect(out.ranOn).toBe("cloud");
    expect(jobs).toHaveLength(1);
  });

  it("writes egress rows to the user's ledger with allowed/denied", async () => {
    const env = freshLocalEnv();
    await acceptEgress(env, {
      sandbox: "settla-pool-01", userId: SAMPLE_USER_ID,
      rows: [
        { ts: 1, domain: "api.tokenfactory.nebius.com", port: 443, action: "Allowed" },
        { ts: 2, domain: "example.com", port: 443, action: "Denied", reason: "not allowed by any policy" },
      ],
    });
    const { entries, verified } = await listLedger(env, SAMPLE_USER_ID, 10);
    expect(verified).toBe(true);
    expect(entries.map((e) => [e.kind, e.what, e.action])).toEqual([
      ["egress", "example.com", "denied"],
      ["egress", "api.tokenfactory.nebius.com", "allowed"],
    ]);
  });
});

describe("job result ingest", () => {
  it("accepts only the HMAC job token and publishes the audit under limits:latest", async () => {
    const { acceptJobResult, jobToken, requireJobToken } = await import("@/lib/agent/job");
    const env = freshLocalEnv({ BRIDGE_SECRET: "s3cret-for-test" });
    const bad = new Request("https://x/api/bridge/job-result", { method: "POST", headers: { "x-job-token": "nope" } });
    await expect(requireJobToken(bad, env)).rejects.toThrow();
    const raw = new Request("https://x", { headers: { "x-job-token": "s3cret-for-test" } });
    await expect(requireJobToken(raw, env)).rejects.toThrow(); // the bridge secret itself is not a job token
    const ok = new Request("https://x", { headers: { "x-job-token": await jobToken("s3cret-for-test") } });
    await expect(requireJobToken(ok, env)).resolves.toBeUndefined();
    await env.CACHE.put("limits:latest", JSON.stringify({ eval: { n: 1 } }));
    await acceptJobResult(env, {
      job: "settla-guardrails-audit", ranAt: "2026-10-30T00:00:00Z", region: "eu-west2", platform: "cpu-d3", tool: "nemoguardrails",
      toolVersion: "0.24.1", model: "m", total: 23, categories: { benign: { n: 8, correct: 8 } }, harmfulBlockRate: 0.93,
      benignAllowRate: 1, p50Ms: 200, p95Ms: 1400, failures: [],
    });
    const stored = JSON.parse((await env.CACHE.get("limits:latest"))!);
    expect(stored.eval).toEqual({ n: 1 });
    expect(stored.audit.harmfulBlockRate).toBe(0.93);
    expect((await listLedger(env, "global", 5)).entries[0].kind).toBe("job");
  });
});
