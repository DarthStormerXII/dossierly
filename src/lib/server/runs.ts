import type { Env } from "./env";
import { randomId } from "./util";

export type RanOn = "cloud" | "sandbox" | "replay";
export type Run = {
  model: string;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  costUsd: number;
  ranOn: RanOn;
};

export async function recordRun(env: Env, userId: string | null, run: Run, feature?: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO runs (id, user_id, ts, feature, model, ms, tokens_in, tokens_out, cached_tokens, cost_micro, ran_on) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    randomId("r"), userId, Date.now(), feature ?? null, run.model, Math.round(run.ms), run.tokensIn, run.tokensOut,
    run.cachedTokens, Math.round(run.costUsd * 1_000_000), run.ranOn,
  ).run();
}

export async function listRuns(env: Env, userId: string, limit = 50): Promise<(Run & { ts: number; feature: string | null })[]> {
  const { results } = await env.DB.prepare(
    "SELECT ts, feature, model, ms, tokens_in, tokens_out, cached_tokens, cost_micro, ran_on FROM runs WHERE user_id = ? ORDER BY ts DESC LIMIT ?",
  ).bind(userId, Math.min(Math.max(limit, 1), 200)).all<{
    ts: number; feature: string | null; model: string; ms: number; tokens_in: number; tokens_out: number;
    cached_tokens: number; cost_micro: number; ran_on: RanOn;
  }>();
  return results.map((r) => ({
    ts: r.ts, feature: r.feature, model: r.model, ms: r.ms, tokensIn: r.tokens_in, tokensOut: r.tokens_out,
    cachedTokens: r.cached_tokens, costUsd: r.cost_micro / 1_000_000, ranOn: r.ran_on,
  }));
}
