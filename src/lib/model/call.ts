import type { ZodType } from "zod";
import { MODEL_TABLE, MODEL_IDS, PRICES, type ModelTask } from "../config";
import type { Masker } from "../mask";
import type { Env } from "../server/env";
import { checkAndSpend } from "../server/budget";
import { recordLedger } from "../server/ledger";
import { recordRun, type Run } from "../server/runs";
import { makeRun } from "./cost";
import { callJson } from "./json";
import { createTokenFactoryClient } from "./tokenfactory";
import type { ChatClient, ChatMessage, ContentPart, TokenLogprob } from "./types";
import { ModelError } from "./types";

export interface Ctx {
  env: Env;
  userId: string | null;
  /** Test double; production builds the Token Factory client from env.NEBIUS_API_KEY. */
  client?: ChatClient;
}

export interface ModelCall<T> {
  task: ModelTask;
  /** Rules and schema only: a stable prefix, never user data, never masked. */
  system: string;
  /** Case context. Masked here before it leaves. */
  context?: string;
  /** The new input. Masked here before it leaves. */
  input: string;
  /** Data URLs. Pixels cannot be masked, so these only go to the vision model. */
  images?: string[];
  schema: ZodType<T>;
  maxTokens: number;
  thinking?: boolean;
  flex?: boolean;
  logprobs?: boolean;
  masker: Masker;
  /** Recorded stand-in, served as ranOn "replay" when over the daily cap or in fixture mode. */
  replay: () => T;
  json?: "json_object" | Record<string, unknown>;
}

export interface ModelOut<T> {
  data: T;
  run: Run;
  masked: number;
  raw: string;
  logprobs?: TokenLogprob[];
}

const estTokens = (s: string) => Math.ceil(s.length / 3);

/** Upper-bound cost estimate used to reserve budget before the call. */
export function estimateCostUsd(task: ModelTask, textChars: number, images: number, maxTokens: number): number {
  const p = PRICES[MODEL_TABLE[task]];
  const tin = estTokens("x".repeat(textChars)) + images * 1500;
  return (tin * p.in + maxTokens * 0.6 * p.out) / 1_000_000;
}

function buildMessages(call: { system: string; context?: string; input: string; images?: string[] }): ChatMessage[] {
  // Order is the cache key: rules, then case context, then the new input.
  const text = `${call.context ? `CASE CONTEXT\n${call.context}\n\n` : ""}INPUT\n${call.input}`;
  const user: string | ContentPart[] = call.images?.length
    ? [{ type: "text", text }, ...call.images.map((url): ContentPart => ({ type: "image_url", image_url: { url } }))]
    : text;
  return [
    { role: "system", content: call.system },
    { role: "user", content: user },
  ];
}

async function safely(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch {
    /* bookkeeping must never fail a user request */
  }
}

const fixtureMode = () => process.env.DEMO_FIXTURES === "1";

export async function runModel<T>(ctx: Ctx, call: ModelCall<T>): Promise<ModelOut<T>> {
  const model = MODEL_IDS[MODEL_TABLE[call.task]];
  const context = call.context ? call.masker.mask(call.context) : undefined;
  const input = call.masker.mask(call.input);
  const masked = call.masker.count;
  const messages = buildMessages({ system: call.system, context, input, images: call.images });
  const bytes = JSON.stringify(messages).length;

  const replay = async (): Promise<ModelOut<T>> => {
    const data = call.replay();
    const run = makeRun(model, 40, { tokensIn: 0, tokensOut: 0, cachedTokens: 0 }, "replay");
    await safely(recordRun(ctx.env, ctx.userId, run, call.task));
    return { data, run, masked, raw: "" };
  };

  const key = ctx.env.NEBIUS_API_KEY;
  if (!ctx.client && !key) {
    if (fixtureMode()) return replay();
    throw new ModelError("The model service is not configured", "no_key", 503);
  }

  const reserve = estimateCostUsd(call.task, (context?.length ?? 0) + input.length + call.system.length, call.images?.length ?? 0, call.maxTokens);
  const allowed = await checkAndSpend(ctx.env, "tf_usd", reserve, { userId: ctx.userId ?? undefined });
  if (!allowed) return replay();

  const client = ctx.client ?? createTokenFactoryClient(key);
  const t0 = Date.now();
  const res = await callJson(
    client,
    {
      model,
      messages,
      maxTokens: call.maxTokens,
      thinking: call.thinking ?? false,
      flex: call.flex,
      logprobs: call.logprobs,
      json: call.json ?? "json_object",
    },
    call.schema,
  );
  const run = makeRun(model, Date.now() - t0, res.usage, "cloud");
  await safely(recordLedger(ctx.env, { userId: ctx.userId, kind: "model", what: model, action: "allowed", bytes, masked, detail: { task: call.task } }));
  await safely(recordRun(ctx.env, ctx.userId, run, call.task));
  return { data: call.masker.restoreDeep(res.data), run, masked, raw: res.raw, logprobs: res.logprobs };
}
