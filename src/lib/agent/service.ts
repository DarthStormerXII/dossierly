import { MODEL_IDS } from "../config";
import { makeRun } from "../model/cost";
import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { recordLedger } from "../server/ledger";
import { recordRun } from "../server/runs";
import { runInBackground } from "./background";
import { finalise, runCloudTask } from "./fallback";
import {
  FALLBACK_AFTER_MS, STALE_CLAIM_MS, claimForCloud, finishTask, getTask, parseTrace, setTrace, type TaskRow,
} from "./queue";
import { EgressRowSchema, type BridgeEgress, type BridgeResult, type TraceStep } from "./schemas";

type Deps = { schedule?: (work: () => Promise<unknown>) => void; client?: ChatClient };

/**
 * Called on every status poll. A task nobody claimed within 20 s, or a sandbox claim that went
 * silent, is taken over by the cloud exactly once (the claim is an atomic UPDATE).
 */
export async function advanceTask(env: Env, row: TaskRow, now = Date.now(), deps: Deps = {}): Promise<TaskRow> {
  const unclaimed = row.status === "queued" && now - row.created_at >= FALLBACK_AFTER_MS;
  const stale = row.status === "running" && row.ran_on === "sandbox" && row.claimed_at !== null && now - row.claimed_at >= STALE_CLAIM_MS;
  if (!unclaimed && !stale) return row;
  if (!(await claimForCloud(env, row, now))) return (await getTask(env, row.id)) ?? row;
  const taken = (await getTask(env, row.id)) ?? row;
  const reason = stale ? "the sandbox stopped answering, taking over in the cloud" : "no bridge claimed the task within 20 s, running in the cloud";
  (deps.schedule ?? runInBackground)(() => runCloudTask(env, taken, { client: deps.client, reason }));
  return taken;
}

/** POST /api/bridge/result. Idempotent; invalid or failed sandbox output is rescued in the cloud. */
export async function acceptBridgeResult(env: Env, body: BridgeResult, deps: Deps = {}): Promise<{ accepted: boolean; ranOn?: string }> {
  const row = await getTask(env, body.taskId);
  if (!row || row.status !== "running" || row.ran_on !== "sandbox") return { accepted: false };
  const trace: TraceStep[] = [...parseTrace(row.trace), ...body.trace];
  let failure = body.ok ? "" : body.error ?? "the sandbox run failed";
  let outcome: ReturnType<typeof finalise> | null = null;
  if (body.ok) {
    try {
      outcome = finalise(row.kind, body.result, JSON.parse(row.input ?? "{}"));
    } catch (err) {
      failure = `sandbox answer rejected: ${err instanceof Error ? err.message.slice(0, 150) : "invalid"}`;
    }
  }
  if (!outcome) {
    await setTrace(env, row.id, [...trace, { step: `${failure}; falling back to the cloud`, ms: 0 }]);
    const fresh = (await getTask(env, row.id)) ?? row;
    if (await claimForCloud(env, fresh)) {
      const taken = (await getTask(env, row.id)) ?? fresh;
      (deps.schedule ?? runInBackground)(() => runCloudTask(env, taken, { client: deps.client, reason: "sandbox could not answer, running in the cloud" }));
    }
    return { accepted: true, ranOn: "cloud" };
  }
  if (outcome.note) trace.push({ step: outcome.note, ms: 0 });
  const usage = { tokensIn: body.tokensIn, tokensOut: body.tokensOut, cachedTokens: 0 };
  const run = makeRun(MODEL_IDS.superVl, body.durationMs, usage, "sandbox");
  const done = await finishTask(env, row.id, {
    status: "done", ranOn: "sandbox", sandbox: body.sandbox, trace, result: { data: outcome.data, run },
  });
  if (done) {
    await recordRun(env, row.user_id, run, `agent:${row.kind}`);
    await recordLedger(env, {
      userId: row.user_id, kind: "model", what: `Nemotron 3.5 Super VL, ${row.kind} (in your private sandbox)`,
      action: "allowed", masked: body.masked,
      detail: { ranOn: "sandbox", sandbox: body.sandbox, tokensEstimated: true },
    });
  }
  return { accepted: done, ranOn: "sandbox" };
}

/** POST /api/bridge/egress: OpenShell audit rows into the user's privacy ledger. */
export async function acceptEgress(env: Env, body: BridgeEgress): Promise<{ recorded: number }> {
  let recorded = 0;
  for (const raw of body.rows) {
    const row = EgressRowSchema.parse(raw);
    await recordLedger(env, {
      userId: body.userId, kind: "egress",
      what: `${row.domain}${row.port && row.port !== 443 ? `:${row.port}` : ""}${row.method ? ` ${row.method}` : ""}`,
      action: row.action === "Denied" ? "denied" : "allowed",
      detail: { source: "openshell-ocsf", sandbox: body.sandbox, at: row.ts, process: row.process, reason: row.reason, policySha256: body.policySha256 },
    });
    recorded++;
  }
  return { recorded };
}
