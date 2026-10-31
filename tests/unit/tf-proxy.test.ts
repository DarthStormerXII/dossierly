import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_IDS } from "@/lib/config";
import { costUsd } from "@/lib/model/cost";
import { GLOBAL_CAPS, checkAndSpend, getBudgets } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";
import { proxyChat, proxyModels, tfProxySig } from "@/lib/server/tfproxy";

const MODEL = MODEL_IDS.superVl;
const OVER = "Daily limit reached. Try again after 08:00 MYT.";
const usage = { prompt_tokens: 2000, completion_tokens: 500, prompt_tokens_details: { cached_tokens: 1000 } };
const actual = costUsd(MODEL, { tokensIn: 2000, tokensOut: 500, cachedTokens: 1000 });

const envFor = (o = {}) => freshLocalEnv({ NEBIUS_API_KEY: "server-key", BRIDGE_SECRET: "s3cret", ...o });
const sigFor = (sandbox: string) => createHmac("sha256", "s3cret").update(`tf-proxy:${sandbox}`).digest("hex");
const post = (body: unknown) => new Request("https://x.test/api/tf/box/sig/v1/chat/completions", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const chat = (over = {}) => ({ model: MODEL, messages: [{ role: "user", content: "Hello" }], ...over });
const spent = async (env: ReturnType<typeof freshLocalEnv>) => (await getBudgets(env)).tf_usd.spent;

function stubFetch(make: () => Response) {
  const seen: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    seen.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : {} });
    return make();
  });
  return seen;
}
const run = async (env: ReturnType<typeof freshLocalEnv>, req: Request, sandbox = "box") => {
  const pending: Promise<unknown>[] = [];
  const res = await proxyChat(env, req, sandbox, sigFor(sandbox), (p) => void pending.push(p));
  return { res, settle: () => Promise.all(pending) };
};

afterEach(() => vi.unstubAllGlobals());

describe("Token Factory metering proxy", () => {
  it("signs sandbox names with the same HMAC the bridge computes", async () => {
    expect(await tfProxySig("s3cret", "settla-pool-01")).toBe(sigFor("settla-pool-01"));
  });

  it("rejects a bad or foreign signature with 401 and forwards nothing", async () => {
    const seen = stubFetch(() => Response.json({}));
    const env = envFor();
    await expect(proxyChat(env, post(chat()), "box", "deadbeef", () => {})).rejects.toMatchObject({ status: 401 });
    await expect(proxyChat(env, post(chat()), "other", sigFor("box"), () => {})).rejects.toMatchObject({ status: 401 });
    await expect(proxyModels(env, "box", "nope")).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveLength(0);
  });

  it("returns an OpenAI-style 429 over the cap and does not forward", async () => {
    const seen = stubFetch(() => Response.json({}));
    const env = envFor();
    await checkAndSpend(env, "tf_usd", GLOBAL_CAPS.tf_usd);
    const { res } = await run(env, post(chat()));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: { message: OVER, type: "rate_limit_error", code: "over_budget" } });
    expect(seen).toHaveLength(0);
  });

  it("forwards non-streamed calls with the server key and forced settings, then settles from usage", async () => {
    const seen = stubFetch(() => Response.json({ id: "c1", choices: [{ message: { content: "Hi" } }], usage }));
    const env = envFor();
    const { res } = await run(env, post(chat({ store: true, n: 3, max_completion_tokens: 50_000 })));
    expect(res.status).toBe(200);
    expect((await res.json() as { id: string }).id).toBe("c1");
    expect(seen[0].url).toBe("https://api.tokenfactory.nebius.com/v1/chat/completions");
    expect((seen[0].init.headers as Record<string, string>).authorization).toBe("Bearer server-key");
    expect(seen[0].body).toMatchObject({ store: false, n: 1, max_tokens: 32_768 });
    expect(seen[0].body.max_completion_tokens).toBeUndefined();
    expect(await spent(env)).toBeCloseTo(actual, 6);
    const run1 = await env.DB.prepare("SELECT feature, model, ran_on, tokens_in FROM runs").all();
    expect(run1.results).toEqual([{ feature: "agent", model: MODEL, ran_on: "sandbox", tokens_in: 2000 }]);
    const led = await env.DB.prepare("SELECT kind, what FROM ledger").all();
    expect(led.results).toEqual([{ kind: "model", what: MODEL }]);
  });

  it("assumes 4096 output tokens when max_tokens is absent, and settles at the reservation without usage", async () => {
    const seen = stubFetch(() => Response.json({ choices: [] }));
    const env = envFor();
    await run(env, post(chat()));
    expect(seen[0].body.max_tokens).toBe(4096);
    expect(await spent(env)).toBeGreaterThan((4096 * 0.9) / 1e6 - 1e-6);
  });

  it("releases the reservation when Token Factory errors", async () => {
    stubFetch(() => Response.json({ error: { message: "bad" } }, { status: 400 }));
    const env = envFor();
    const { res } = await run(env, post(chat()));
    expect(res.status).toBe(400);
    expect(await spent(env)).toBe(0);
  });

  it("streams unchanged, asks for usage, and settles from the final usage chunk", async () => {
    const lines = [
      `data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":"lo"}}]}\n\n`,
      `data: {"choices":[],"usage":${JSON.stringify(usage)}}\n\n`,
      "data: [DONE]\n\n",
    ].join("");
    const cut = Math.floor(lines.length / 2) + 7; // split mid-line to prove buffering
    const seen = stubFetch(() => new Response(new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(enc.encode(lines.slice(0, cut)));
        c.enqueue(enc.encode(lines.slice(cut)));
        c.close();
      },
    }), { headers: { "content-type": "text/event-stream" } }));
    const env = envFor();
    const { res, settle } = await run(env, post(chat({ stream: true, max_tokens: 600 })));
    expect(await res.text()).toBe(lines);
    await settle();
    expect(seen[0].body.stream_options).toMatchObject({ include_usage: true });
    expect(await spent(env)).toBeCloseTo(actual, 6);
    expect((await env.DB.prepare("SELECT ran_on FROM runs").all()).results).toEqual([{ ran_on: "sandbox" }]);
  });

  it("settles a stream with no usage chunk at the reservation, never zero", async () => {
    stubFetch(() => new Response(`data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } }));
    const env = envFor();
    const { res, settle } = await run(env, post(chat({ stream: true, max_tokens: 1000 })));
    await res.text();
    await settle();
    expect(await spent(env)).toBeGreaterThan(1000 * 0.9 / 1e6 - 1e-6);
  });

  it("validates the body: unknown model, no messages, oversized, not JSON", async () => {
    const seen = stubFetch(() => Response.json({}));
    const env = envFor();
    expect((await run(env, post(chat({ model: "gpt-4o" })))).res.status).toBe(400);
    expect((await run(env, post({ model: MODEL, messages: [] }))).res.status).toBe(400);
    expect((await run(env, post("not json"))).res.status).toBe(400);
    expect((await run(env, post("x".repeat(2_000_001)))).res.status).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it("is switched off by MODELS_DISABLED=1 (chat and models)", async () => {
    const seen = stubFetch(() => Response.json({}));
    const env = envFor({ MODELS_DISABLED: "1" });
    const { res } = await run(env, post(chat()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Model calls are switched off", code: "models_disabled" });
    expect((await proxyModels(env, "box", sigFor("box"))).status).toBe(503);
    expect(seen).toHaveLength(0);
  });

  it("passes GET /v1/models through", async () => {
    const seen = stubFetch(() => Response.json({ data: [{ id: MODEL }] }));
    const res = await proxyModels(envFor(), "box", sigFor("box"));
    expect(res.status).toBe(200);
    expect(seen[0].url).toBe("https://api.tokenfactory.nebius.com/v1/models");
  });
});
