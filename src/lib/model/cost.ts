import { EMBEDDING_PRICE_PER_M, PRICES, keyForModelId } from "../config";
import type { Run } from "../server/runs";
import type { Usage } from "./types";

export type { Run };

/** List-price cost in USD; cached input tokens bill at the cached rate. */
export function costUsd(modelId: string, u: Usage): number {
  const p = PRICES[keyForModelId(modelId)];
  const fresh = Math.max(0, u.tokensIn - u.cachedTokens);
  return (fresh * p.in + u.cachedTokens * p.cached + u.tokensOut * p.out) / 1_000_000;
}

export const embeddingCostUsd = (tokens: number) => (tokens * EMBEDDING_PRICE_PER_M) / 1_000_000;

export function emptyUsage(): Usage {
  return { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    cachedTokens: a.cachedTokens + b.cachedTokens,
  };
}

export function makeRun(model: string, ms: number, usage: Usage, ranOn: Run["ranOn"]): Run {
  return {
    model,
    ms: Math.round(ms),
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    cachedTokens: usage.cachedTokens,
    costUsd: Number(costUsd(model, usage).toFixed(6)),
    ranOn,
  };
}

/** Sum several runs of the same model into one (multi-page letters, retries). */
export function sumRuns(runs: Run[]): Run {
  const u = runs.reduce((acc, r) => addUsage(acc, r), emptyUsage());
  const first = runs[0];
  return {
    model: first?.model ?? "",
    ms: runs.reduce((m, r) => Math.max(m, r.ms), 0),
    tokensIn: u.tokensIn,
    tokensOut: u.tokensOut,
    cachedTokens: u.cachedTokens,
    costUsd: Number(runs.reduce((s, r) => s + r.costUsd, 0).toFixed(6)),
    ranOn: runs.every((r) => r.ranOn === "replay") ? "replay" : runs.find((r) => r.ranOn !== "replay")?.ranOn ?? "cloud",
  };
}
