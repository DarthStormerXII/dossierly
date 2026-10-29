import OpenAI from "openai";
import { EMBEDDING_MODEL, TOKENFACTORY_BASE_URL } from "../config";
import type { ChatClient, ChatRequest, ChatResult, TokenLogprob } from "./types";
import { ModelError } from "./types";

function mapError(err: unknown): never {
  if (err instanceof ModelError) throw err;
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) throw new ModelError("The model service is busy, try again", "rate_limited", 429);
    if (err.status === 401 || err.status === 403) {
      throw new ModelError("The model service rejected the API key", "provider_unavailable");
    }
    throw new ModelError("The model service returned an error", "model_error");
  }
  throw new ModelError("Could not reach the model service", "provider_unavailable");
}

export function createSdk(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: TOKENFACTORY_BASE_URL, maxRetries: 1, timeout: 60_000 });
}

export function createTokenFactoryClient(apiKey: string): ChatClient {
  const sdk = createSdk(apiKey);
  return {
    async chat(req: ChatRequest): Promise<ChatResult> {
      // Token Factory extras (store, chat_template_kwargs, service_tier) pass straight through the SDK body.
      const body: Record<string, unknown> = {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens,
        store: false,
      };
      if (!req.thinking) body.chat_template_kwargs = { enable_thinking: false };
      if (req.flex) body.service_tier = "flex";
      if (req.logprobs) Object.assign(body, { logprobs: true, top_logprobs: 1 });
      if (req.json === "json_object") body.response_format = { type: "json_object" };
      else if (req.json) {
        body.response_format = { type: "json_schema", json_schema: { name: "result", strict: true, schema: req.json } };
      }
      try {
        const res = await sdk.chat.completions.create(body as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
        const choice = res.choices[0];
        const content = choice?.message?.content;
        if (!content) throw new ModelError("Model returned an empty reply", "model_error");
        const u = res.usage as (OpenAI.CompletionUsage & { prompt_tokens_details?: { cached_tokens?: number } }) | undefined;
        const lp = choice.logprobs?.content as Array<{ token: string; logprob: number }> | null | undefined;
        return {
          content,
          usage: {
            tokensIn: u?.prompt_tokens ?? 0,
            tokensOut: u?.completion_tokens ?? 0,
            cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
          },
          logprobs: lp?.map((t): TokenLogprob => ({ token: t.token, logprob: t.logprob })),
        };
      } catch (err) {
        return mapError(err);
      }
    },
  };
}

/** Qwen3-Embedding-8B on Token Factory ($0.01 per million tokens). */
export async function embedTokenFactory(apiKey: string, inputs: string[]): Promise<{ vectors: number[][]; tokens: number }> {
  try {
    const res = await createSdk(apiKey).embeddings.create({ model: EMBEDDING_MODEL, input: inputs });
    return { vectors: res.data.map((d) => d.embedding), tokens: res.usage?.prompt_tokens ?? 0 };
  } catch (err) {
    return mapError(err);
  }
}
