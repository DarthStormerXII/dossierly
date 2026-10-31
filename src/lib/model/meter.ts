/*
 * The one place Token Factory spend is counted. Every path that can reach Token Factory (runModel,
 * the agent cloud fallback, hub embeddings, the sandbox proxy) reserves an upper-bound estimate
 * against the daily cap first, then settles to the actual cost from the response usage.
 */
import { PRICES, keyForModelId } from "../config";
import type { Env } from "../server/env";
import { checkAndSpend, settleSpend } from "../server/budget";
import { costUsd, embeddingCostUsd, estimateInputTokens } from "./cost";
import { embedTokenFactory } from "./tokenfactory";
import type { ChatClient, ChatRequest } from "./types";
import { ModelError } from "./types";

export const OVER_BUDGET_MESSAGE = "Daily limit reached. Try again after 08:00 MYT.";
export const MODELS_OFF_MESSAGE = "Model calls are switched off";

/** Kill switch: MODELS_DISABLED="1" stops every model call. */
export const modelsDisabled = (env: Pick<Env, "MODELS_DISABLED">): boolean => String(env.MODELS_DISABLED ?? "").trim() === "1";

export function assertModelsEnabled(env: Pick<Env, "MODELS_DISABLED">): void {
  if (modelsDisabled(env)) throw new ModelError(MODELS_OFF_MESSAGE, "models_disabled", 503);
}

/** Upper-bound USD for one chat call: estimated input at the input price plus all of max_tokens at the output price. */
export function estimateChatUsd(model: string, payload: unknown, maxTokens: number): number {
  const p = PRICES[keyForModelId(model)];
  return (estimateInputTokens(payload) * p.in + maxTokens * p.out) / 1_000_000;
}

/** Upper-bound USD for an embedding call (price is tiny; the estimate keeps a floor so it is never free). */
export function estimateEmbedUsd(inputs: string[]): number {
  const chars = inputs.reduce((n, s) => n + s.length, 0);
  return Math.max(embeddingCostUsd(Math.ceil(chars / 3)), 0.000001);
}

/** Atomically reserves `usd` against today's cap; throws the over_budget error when it would pass it. */
export async function reserveTokenFactory(env: Env, usd: number): Promise<void> {
  if (!(await checkAndSpend(env, "tf_usd", usd))) throw new ModelError(OVER_BUDGET_MESSAGE, "over_budget", 429);
}

/** Settles a reservation to the real cost (0 releases it). Bookkeeping must never fail the user's request. */
export async function settleTokenFactory(env: Env, reservedUsd: number, actualUsd: number): Promise<void> {
  try {
    await settleSpend(env, "tf_usd", reservedUsd, actualUsd);
  } catch {
    /* the reservation stands, which errs on the side of the cap */
  }
}

/** Wraps a chat client so each call (including a JSON retry or a fallback model) is reserved, then settled. */
export function meterClient(env: Env, inner: ChatClient): ChatClient {
  return {
    async chat(req: ChatRequest) {
      assertModelsEnabled(env);
      const reserved = estimateChatUsd(req.model, req.messages, req.maxTokens);
      await reserveTokenFactory(env, reserved);
      try {
        const res = await inner.chat(req);
        await settleTokenFactory(env, reserved, costUsd(req.model, res.usage));
        return res;
      } catch (err) {
        // A reply the provider billed but we could not use carries its usage; any other failure had none.
        await settleTokenFactory(env, reserved, err instanceof ModelError && err.usage ? costUsd(req.model, err.usage) : 0);
        throw err;
      }
    },
  };
}

/** Qwen embeddings on Token Factory, metered. */
export async function meteredEmbed(env: Env, inputs: string[]): Promise<{ vectors: number[][]; tokens: number }> {
  assertModelsEnabled(env);
  const reserved = estimateEmbedUsd(inputs);
  await reserveTokenFactory(env, reserved);
  try {
    const out = await embedTokenFactory(env.NEBIUS_API_KEY, inputs);
    await settleTokenFactory(env, reserved, out.tokens > 0 ? embeddingCostUsd(out.tokens) : reserved);
    return out;
  } catch (err) {
    await settleTokenFactory(env, reserved, 0);
    throw err;
  }
}
