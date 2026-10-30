import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MODEL_IDS, MODEL_TABLE, modelIdFor } from "@/lib/config";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { costUsd } from "@/lib/model/cost";
import { ModelError, type ChatClient, type ChatRequest } from "@/lib/model/types";
import { GLOBAL_CAPS, checkAndSpend } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";

const sdk: { calls: Array<Record<string, unknown>>; impl: (b: unknown) => Promise<unknown> } = { calls: [], impl: async () => ({}) };
// A plain function, not vi.fn: vitest chains onto spy results, which turns a rejected mock into an unhandled rejection.
const create = (body: unknown) => {
  sdk.calls.push(body as Record<string, unknown>);
  return sdk.impl(body);
};
vi.mock("openai", () => {
  class APIError extends Error {
    constructor(readonly status: number) {
      super("api");
    }
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create } };
  }
  return { default: OpenAI };
});

const schema = z.object({ translation: z.string() });
function fake(content: string, usage = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 }) {
  const calls: ChatRequest[] = [];
  const client: ChatClient = {
    async chat(r) {
      calls.push(r);
      return { content, usage };
    },
  };
  return { client, calls };
}
const base = () => ({
  task: "interpret" as const,
  system: "RULES",
  context: "Applicant Arjun Raman, case WSC-II-P.6151.48213.2026",
  input: "Translate: my PESEL is 44051401359",
  schema,
  maxTokens: 300,
  masker: maskerFor({ name: "Arjun Raman", caseNumber: "WSC-II-P.6151.48213.2026" }),
  replay: () => ({ translation: "REPLAY" }),
});

beforeEach(() => {
  sdk.calls = [];
});

describe("model table and cost", () => {
  it("uses the exact Token Factory IDs and never the removed models", () => {
    expect(MODEL_IDS).toEqual({
      lightning: "nvidia/Nemotron-3_5-Lightning",
      superVl: "nvidia/Nemotron-3.5-Super-VL",
      ultra: "nvidia/Nemotron-3-Ultra-550b-a55b",
    });
    expect(Object.values(MODEL_IDS).join()).not.toMatch(/120b|Nano/i);
    expect(modelIdFor("link")).toBe(MODEL_IDS.ultra);
    expect(modelIdFor("watch")).toBe(MODEL_IDS.superVl);
    expect(MODEL_TABLE.interpret).toBe("lightning");
  });
  it("costs from list prices with cached tokens at the cached rate", () => {
    const u = { tokensIn: 1000, tokensOut: 100, cachedTokens: 600 };
    expect(costUsd(MODEL_IDS.lightning, u)).toBeCloseTo((400 * 0.06 + 600 * 0.03 + 100 * 0.24) / 1e6, 10);
    expect(costUsd(MODEL_IDS.superVl, u)).toBeCloseTo((400 * 0.3 + 600 * 0.06 + 100 * 0.9) / 1e6, 10);
    expect(costUsd(MODEL_IDS.ultra, u)).toBeCloseTo((400 * 1 + 600 * 0.12 + 100 * 3) / 1e6, 10);
  });
});

describe("runModel", () => {
  it("masks before the call, orders the prompt for caching, restores the output, and logs", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test-key" });
    const { client, calls } = fake('{"translation":"Pan [NAME_1], sprawa [CASE_1]"}');
    const out = await runModel({ env, userId: "u1", client }, base());
    const sent = JSON.stringify(calls[0].messages);
    expect(sent).not.toMatch(/Arjun|Raman|44051401359|WSC-II/);
    expect(sent).toMatch(/\[NAME_1\]/);
    const user = calls[0].messages[1].content as string;
    expect(user.indexOf("CASE CONTEXT")).toBeLessThan(user.indexOf("INPUT"));
    expect(calls[0].messages[0]).toEqual({ role: "system", content: "RULES" });
    expect(out.data.translation).toBe("Pan Arjun Raman, sprawa WSC-II-P.6151.48213.2026");
    expect(out.masked).toBe(3);
    expect(out.run).toMatchObject({ model: MODEL_IDS.lightning, tokensIn: 1000, tokensOut: 100, cachedTokens: 600, ranOn: "cloud" });
    expect(out.run.costUsd).toBeGreaterThan(0);
    const led = await env.DB.prepare("SELECT kind, what, masked, bytes FROM ledger WHERE user_id = ?").bind("u1").all<{ kind: string; what: string; masked: number; bytes: number }>();
    expect(led.results).toHaveLength(1);
    expect(led.results[0]).toMatchObject({ kind: "model", what: MODEL_IDS.lightning, masked: 3 });
    expect(led.results[0].bytes).toBeGreaterThan(50);
    const runs = await env.DB.prepare("SELECT feature, ran_on FROM runs WHERE user_id = ?").bind("u1").all();
    expect(runs.results).toEqual([{ feature: "interpret", ran_on: "cloud" }]);
  });

  it("serves the recorded fixture as replay once the daily cap is spent, without calling the model", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test-key" });
    expect(await checkAndSpend(env, "tf_usd", GLOBAL_CAPS.tf_usd)).toBe(true);
    const { client, calls } = fake('{"translation":"LIVE"}');
    const out = await runModel({ env, userId: "u1", client }, base());
    expect(out.data.translation).toBe("REPLAY");
    expect(out.run).toMatchObject({ ranOn: "replay", costUsd: 0, tokensIn: 0 });
    expect(calls).toHaveLength(0);
  });

  it("fails clearly with no key unless fixture mode is on", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "" });
    await expect(runModel({ env, userId: null }, base())).rejects.toMatchObject({ code: "no_key" });
    vi.stubEnv("DEMO_FIXTURES", "1");
    const out = await runModel({ env, userId: null }, base());
    vi.unstubAllEnvs();
    expect(out.run.ranOn).toBe("replay");
    expect(out.data.translation).toBe("REPLAY");
  });

  it("retries once on invalid JSON and bills both attempts", async () => {
    const env = freshLocalEnv({ NEBIUS_API_KEY: "test-key" });
    let n = 0;
    const client: ChatClient = {
      async chat() {
        n++;
        return { content: n === 1 ? "not json" : '{"translation":"ok"}', usage: { tokensIn: 100, tokensOut: 10, cachedTokens: 0 } };
      },
    };
    const out = await runModel({ env, userId: null, client }, { ...base(), context: undefined });
    expect(out.data.translation).toBe("ok");
    expect(out.run.tokensIn).toBe(200);
  });
});

describe("Token Factory client", () => {
  const ok = { choices: [{ message: { content: '{"a":1}' }, logprobs: { content: [{ token: "{", logprob: -0.1 }] } }], usage: { prompt_tokens: 50, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 20 } } };

  it("sends store:false, thinking off, flex only when asked, and reads cached tokens and logprobs", async () => {
    const { createTokenFactoryClient } = await import("@/lib/model/tokenfactory");
    sdk.impl = async () => ok;
    const c = createTokenFactoryClient("k");
    const res = await c.chat({ model: "m", messages: [], maxTokens: 10, thinking: false, flex: true, logprobs: true, json: "json_object" });
    const body = sdk.calls[0];
    expect(body.store).toBe(false);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body.service_tier).toBe("flex");
    expect(body.logprobs).toBe(true);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(res.usage).toEqual({ tokensIn: 50, tokensOut: 5, cachedTokens: 20 });
    expect(res.logprobs).toEqual([{ token: "{", logprob: -0.1 }]);

    await c.chat({ model: "m", messages: [], maxTokens: 10, thinking: true });
    const live = sdk.calls[1];
    expect(live.store).toBe(false);
    expect(live.chat_template_kwargs).toBeUndefined();
    expect(live.service_tier).toBeUndefined();
  });

  it("maps provider failures to clean ModelErrors", async () => {
    const { createTokenFactoryClient } = await import("@/lib/model/tokenfactory");
    const OpenAI = (await import("openai")).default as unknown as { APIError: new (s: number) => Error };
    const attempt = async (failure: Error) => {
      sdk.impl = () => Promise.reject(failure);
      try {
        await createTokenFactoryClient("k").chat({ model: "m", messages: [], maxTokens: 1, thinking: false });
        return null;
      } catch (e) {
        return e as ModelError;
      }
    };
    const busy = await attempt(new OpenAI.APIError(429));
    expect(busy).toMatchObject({ code: "rate_limited", status: 429 });
    const other = await attempt(new Error("boom with secret sk-123"));
    expect(other).toBeInstanceOf(ModelError);
    expect(other?.message).not.toMatch(/sk-123/);
  });
});
