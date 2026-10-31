/*
 * Metering proxy for the private-agent sandboxes. The sandboxes used to call Token Factory directly with
 * their own key; now their base_url points here, so every call reserves against the daily cap, is forwarded
 * with the server key, and is settled from the real usage. Auth: sig = hex HMAC-SHA256(BRIDGE_SECRET, "tf-proxy:" + sandbox).
 */
import { z } from "zod";
import { EMBEDDING_MODEL, MODEL_IDS, TOKENFACTORY_BASE_URL } from "../config";
import { costUsd, makeRun } from "../model/cost";
import { MODELS_OFF_MESSAGE, OVER_BUDGET_MESSAGE, estimateChatUsd, modelsDisabled, reserveTokenFactory, settleTokenFactory } from "../model/meter";
import { ModelError, type Usage } from "../model/types";
import type { Env } from "./env";
import { ApiError, jsonError } from "./http";
import { recordLedger } from "./ledger";
import { recordRun } from "./runs";
import { bytesToHex, hmacSha256, timingSafeEqual } from "./util";

export const MAX_BODY_BYTES = 2_000_000;
const DEFAULT_MAX_TOKENS = 4096;
const MAX_MAX_TOKENS = 32_768;
const UPSTREAM_TIMEOUT_MS = 180_000;
const ALLOWED_MODELS = new Set<string>([...Object.values(MODEL_IDS), EMBEDDING_MODEL]);

export type WaitUntil = (p: Promise<unknown>) => void;

export async function tfProxySig(secret: string, sandbox: string): Promise<string> {
  return bytesToHex(await hmacSha256(secret, `tf-proxy:${sandbox}`));
}

async function requireSig(env: Env, sandbox: string, sig: string): Promise<void> {
  if (!env.BRIDGE_SECRET || !sig || !timingSafeEqual(sig, await tfProxySig(env.BRIDGE_SECRET, sandbox))) {
    throw new ApiError(401, "Proxy not authorised", "proxy_unauthorised");
  }
}

const ChatBodySchema = z.object({
  model: z.string().refine((m) => ALLOWED_MODELS.has(m), "model not allowed"),
  messages: z.array(z.unknown()).min(1),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
}).passthrough();

const openAiError = (status: number, message: string, type: string, code: string) =>
  Response.json({ error: { message, type, code } }, { status });

const overBudget = () => openAiError(429, OVER_BUDGET_MESSAGE, "rate_limit_error", "over_budget");
const switchedOff = () => jsonError(503, MODELS_OFF_MESSAGE, "models_disabled");

function usageOf(raw: unknown): Usage | null {
  const u = raw as { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null | undefined;
  if (!u || typeof u.prompt_tokens !== "number" || typeof u.completion_tokens !== "number") return null;
  return { tokensIn: u.prompt_tokens, tokensOut: u.completion_tokens, cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0 };
}

type Call = { env: Env; sandbox: string; model: string; reserved: number; bytes: number; started: number };

/** Settles to the real cost (or to the reservation when no usage came back: never zero) and records the run and ledger rows. */
async function finish(c: Call, usage: Usage | null, streamed: boolean): Promise<void> {
  const actual = usage ? costUsd(c.model, usage) : c.reserved;
  await settleTokenFactory(c.env, c.reserved, actual);
  const run = makeRun(c.model, Date.now() - c.started, usage ?? { tokensIn: 0, tokensOut: 0, cachedTokens: 0 }, "sandbox");
  try {
    await recordRun(c.env, null, { ...run, costUsd: Number(actual.toFixed(6)) }, "agent");
    await recordLedger(c.env, {
      userId: null, kind: "model", what: c.model, action: "allowed", bytes: c.bytes,
      detail: { ranOn: "sandbox", sandbox: c.sandbox, via: "tf-proxy", streamed, usageReported: !!usage, costUsd: Number(actual.toFixed(6)) },
    });
  } catch {
    /* bookkeeping must never fail the sandbox's request */
  }
}

/** Passes the SSE through untouched while watching for the final usage chunk; `done` resolves with it (or null). */
function tap(upstream: ReadableStream<Uint8Array>): { body: ReadableStream<Uint8Array>; done: Promise<Usage | null> } {
  const decoder = new TextDecoder();
  let tail = "";
  let usage: Usage | null = null;
  let resolve!: (u: Usage | null) => void;
  const done = new Promise<Usage | null>((r) => (resolve = r));
  const scan = (text: string) => {
    const lines = text.split("\n");
    tail = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:") || line.includes("[DONE]")) continue;
      try {
        const u = usageOf((JSON.parse(line.slice(5)) as { usage?: unknown }).usage);
        if (u) usage = u;
      } catch {
        /* not a JSON chunk */
      }
    }
  };
  const ts = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      scan(tail + decoder.decode(chunk, { stream: true }));
    },
    flush() {
      scan(`${tail}${decoder.decode()}\n`);
      resolve(usage);
    },
    cancel() {
      resolve(usage);
    },
  } as Transformer<Uint8Array, Uint8Array>);
  return { body: upstream.pipeThrough(ts), done };
}

function forward(env: Env, url: string, init: RequestInit): Promise<Response | null> {
  return fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${env.NEBIUS_API_KEY}` }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    .catch(() => null);
}

const upstreamDown = () => openAiError(502, "The model service could not be reached", "api_error", "provider_unavailable");

export async function proxyChat(env: Env, req: Request, sandbox: string, sig: string, waitUntil: WaitUntil): Promise<Response> {
  await requireSig(env, sandbox, sig);
  if (modelsDisabled(env)) return switchedOff();
  if (!env.NEBIUS_API_KEY) return jsonError(503, "The model service is not configured", "no_key");
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) return jsonError(413, "Request too large", "too_large");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return jsonError(413, "Request too large", "too_large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return jsonError(400, "Request body must be JSON", "invalid_json");
  }
  const parsed = ChatBodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, "Invalid request", "invalid_request");

  const { max_completion_tokens: altMax, ...rest } = parsed.data;
  const maxTokens = Math.min(parsed.data.max_tokens ?? altMax ?? DEFAULT_MAX_TOKENS, MAX_MAX_TOKENS);
  const stream = parsed.data.stream === true;
  // Forced settings: no stored data, one choice, an output bound equal to what is reserved, usage in streams.
  const body: Record<string, unknown> = { ...rest, max_tokens: maxTokens, store: false, n: 1 };
  if (stream) body.stream_options = { ...(rest.stream_options as object | undefined), include_usage: true };
  const model = parsed.data.model;
  const reserved = estimateChatUsd(model, { messages: rest.messages, tools: rest.tools, functions: rest.functions }, maxTokens);
  try {
    await reserveTokenFactory(env, reserved);
  } catch (e) {
    if (e instanceof ModelError && e.code === "over_budget") return overBudget();
    throw e;
  }
  const call: Call = { env, sandbox, model, reserved, bytes: text.length, started: Date.now() };
  const up = await forward(env, `${TOKENFACTORY_BASE_URL}chat/completions`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!up) {
    await settleTokenFactory(env, reserved, 0);
    return upstreamDown();
  }
  if (!up.ok) {
    await settleTokenFactory(env, reserved, 0);
    return new Response(await up.text(), { status: up.status, headers: { "content-type": up.headers.get("content-type") ?? "application/json" } });
  }
  if (stream && up.body) {
    const { body: piped, done } = tap(up.body);
    waitUntil(done.then((usage) => finish(call, usage, true)));
    return new Response(piped, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
  }
  const out = await up.text();
  let usage: Usage | null = null;
  try {
    usage = usageOf((JSON.parse(out) as { usage?: unknown }).usage);
  } catch {
    /* settle at the reservation below */
  }
  await finish(call, usage, false);
  return new Response(out, { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function proxyModels(env: Env, sandbox: string, sig: string): Promise<Response> {
  await requireSig(env, sandbox, sig);
  if (modelsDisabled(env)) return switchedOff();
  const up = await forward(env, `${TOKENFACTORY_BASE_URL}models`, { method: "GET" });
  if (!up) return upstreamDown();
  return new Response(await up.text(), { status: up.status, headers: { "content-type": up.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
}
