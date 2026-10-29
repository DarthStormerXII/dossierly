import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import { recordLedger } from "../server/ledger";
import { bytesToHex, hmacSha256, timingSafeEqual } from "../server/util";
import type { JobResult } from "./schemas";

const TOKEN_LABEL = "settla-job-result";

/** Job-scoped token: HMAC(BRIDGE_SECRET, label). The job holds this, never the bridge secret itself. */
export async function jobToken(secret: string): Promise<string> {
  return bytesToHex(await hmacSha256(secret, TOKEN_LABEL));
}

export async function requireJobToken(req: Request, env: Env): Promise<void> {
  const given = req.headers.get("x-job-token") ?? "";
  if (!env.BRIDGE_SECRET || !given || !timingSafeEqual(given, await jobToken(env.BRIDGE_SECRET))) {
    throw new ApiError(401, "Job not authorised", "job_unauthorised");
  }
}

/** Publishes the audit under `limits:latest.audit` (read by GET /api/limits) and records it as a job in the ledger. */
export async function acceptJobResult(env: Env, r: JobResult): Promise<{ stored: true }> {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse((await env.CACHE.get("limits:latest")) ?? "{}") as Record<string, unknown>;
  } catch {
    current = {};
  }
  const audit = {
    tool: `NeMo Guardrails ${r.toolVersion}`, model: r.model, ranOn: `Nebius Serverless Job, ${r.region}, ${r.platform}`,
    ranAt: r.ranAt, total: r.total, harmfulBlockRate: r.harmfulBlockRate, benignAllowRate: r.benignAllowRate,
    p50Ms: r.p50Ms, p95Ms: r.p95Ms, categories: r.categories, failures: r.failures,
  };
  await env.CACHE.put("limits:latest", JSON.stringify({ ...current, audit, updatedAt: new Date().toISOString() }));
  await recordLedger(env, {
    userId: null, kind: "job",
    what: `${audit.tool} audit on ${audit.ranOn}: ${Math.round(r.harmfulBlockRate * 100)}% harmful blocked, ${Math.round(r.benignAllowRate * 100)}% benign allowed`,
    action: "allowed", detail: { job: r.job, total: r.total },
  });
  return { stored: true };
}
