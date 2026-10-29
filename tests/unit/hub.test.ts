import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUB_DOMAINS } from "@/lib/config";
import { rankPassages } from "@/lib/hub/embed";
import { cachedExtract, cachedSearch } from "@/lib/hub/tavily";
import { b64ToVec, chunkText, cosine, normQuery, normUrl, vecToB64 } from "@/lib/hub/util";
import { freshLocalEnv } from "@/lib/server/local";

describe("cache keys and chunking", () => {
  it("normalises queries and URLs so equivalent requests share a cache entry", () => {
    expect(normQuery("  Residence   CARD fingerprints ")).toBe("residence card fingerprints");
    expect(normUrl("https://Migrant.WSC.mazowieckie.pl/komunikaty/?utm_source=x#top")).toBe("https://migrant.wsc.mazowieckie.pl/komunikaty");
    expect(normUrl("https://migrant.wsc.mazowieckie.pl/komunikaty")).toBe(normUrl("https://migrant.wsc.mazowieckie.pl/komunikaty/"));
    expect(normUrl("https://a.pl/x?id=2")).not.toBe(normUrl("https://a.pl/x?id=3"));
  });
  it("splits long text on paragraph edges and drops fragments", () => {
    const para = "Odciski palców składa się osobiście w urzędzie wojewódzkim. ".repeat(8);
    const chunks = chunkText(`${para}\n\n${para}\n\n${para}\n\nOK`, 900);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.length <= 1000 && c.length > 40)).toBe(true);
    expect(chunks.join(" ")).not.toMatch(/\bOK$/);
  });
  it("round-trips vectors through base64 and computes cosine", () => {
    const v = Float32Array.from([0.25, -1.5, 3]);
    expect(Array.from(b64ToVec(vecToB64(v)))).toEqual(Array.from(v));
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([1, 0]))).toBeCloseTo(1);
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([0, 1]))).toBeCloseTo(0);
  });
});

function stubFetch(handler: (url: string, body: Record<string, unknown>) => unknown) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body });
    const out = handler(url, body);
    return out === null ? new Response("nope", { status: 500 }) : Response.json(out);
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("Tavily wrapper", () => {
  let env: ReturnType<typeof freshLocalEnv>;
  beforeEach(() => {
    env = freshLocalEnv({ TAVILY_API_KEY: "tvly-test" });
  });

  it("searches only the hub domains, caches the result, and serves the repeat from KV", async () => {
    const calls = stubFetch(() => ({ results: [{ title: "Opłaty", url: "https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty", content: "340 zł", score: 0.9 }] }));
    const a = await cachedSearch(env, "Fingerprints  residence card", { userId: "u1" });
    const b = await cachedSearch(env, "fingerprints residence CARD", { userId: "u2" });
    expect(a.origin).toBe("live");
    expect(b.origin).toBe("cache");
    expect(b.hits).toEqual(a.hits);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.tavily.com/search");
    expect(calls[0].body.include_domains).toEqual(HUB_DOMAINS);
  });

  it("allows one live credit per session per day, then refuses without calling out", async () => {
    const calls = stubFetch(() => ({ results: [{ title: "t", url: "https://gov.pl/x", content: "c", score: 1 }] }));
    expect((await cachedSearch(env, "first query", { userId: "u1" })).origin).toBe("live");
    const second = await cachedSearch(env, "second query", { userId: "u1" });
    expect(second.origin).toBe("budget");
    expect(second.hits).toEqual([]);
    expect(calls).toHaveLength(1);
    const led = await env.DB.prepare("SELECT action, region FROM ledger WHERE kind = 'egress' ORDER BY seq").all<{ action: string; region: string }>();
    expect(led.results.map((r) => r.action)).toEqual(["allowed", "denied"]);
    expect(led.results[0].region).toBe("api.tavily.com");
  });

  it("masks identifiers in a query before it leaves", async () => {
    const calls = stubFetch(() => ({ results: [] }));
    await cachedSearch(env, "status of case WSC-II-P.6151.48213.2026 for 44051401359", { userId: "u1" });
    expect(JSON.stringify(calls[0].body)).not.toMatch(/48213|44051401359/);
  });

  it("extracts per URL, caches each page, and bills one credit per five URLs", async () => {
    const calls = stubFetch((_u, body) => ({ results: (body.urls as string[]).map((u) => ({ url: u, raw_content: `page ${u}` })) }));
    const urls = ["https://gov.pl/a", "https://gov.pl/b"];
    const first = await cachedExtract(env, urls, { userId: "u1", demo: true });
    expect(first.origin).toBe("live");
    expect(first.pages).toHaveLength(2);
    const again = await cachedExtract(env, ["https://gov.pl/a/", "https://gov.pl/b#x"], { userId: "u9" });
    expect(again.origin).toBe("cache");
    expect(calls).toHaveLength(1);
    const spent = await env.DB.prepare("SELECT spent_micro FROM budgets WHERE scope = 'global' AND kind = 'tavily_credits'").first<{ spent_micro: number }>();
    expect(spent?.spent_micro).toBe(1_000_000);
  });

  it("does nothing live without a key", async () => {
    const calls = stubFetch(() => ({ results: [] }));
    const r = await cachedSearch(freshLocalEnv({ TAVILY_API_KEY: "" }), "anything");
    expect(r.origin).toBe("no_key");
    expect(calls).toHaveLength(0);
  });
});

describe("passage ranking", () => {
  const passages = [
    { id: "1", url: "https://gov.pl/1", title: "Fees", text: "The stamp duty fee for a residence card is 440 zł." },
    { id: "2", url: "https://gov.pl/2", title: "Fingerprints", text: "Fingerprints are taken in person at the voivodeship office." },
    { id: "3", url: "https://gov.pl/3", title: "Other", text: "Weather and holidays." },
  ];

  it("uses NVIDIA embeddings when they work and reports the provider", async () => {
    const vec = (t: string) => (/fingerprint/i.test(t) ? [1, 0] : /fee|440/i.test(t) ? [0, 1] : [0.1, 0.1]);
    stubFetch((_u, body) => ({ data: (body.input as string[]).map((t) => ({ embedding: vec(t) })) }));
    const env = freshLocalEnv({ NVIDIA_API_KEY: "nv", NEBIUS_API_KEY: "" });
    const r = await rankPassages(env, "where do I give fingerprints", passages, 2, "nvidia");
    expect(r.provider).toBe("nvidia");
    expect(r.ranked[0].id).toBe("2");
    // Second run is served from the KV vector cache: no embedding call for the passages.
    const calls = stubFetch(() => null);
    expect((await rankPassages(env, "where do I give fingerprints", passages, 2, "nvidia")).provider).toBe("nvidia");
    expect(calls).toHaveLength(0);
  });

  it("falls back to lexical overlap when no embedding provider works", async () => {
    stubFetch(() => null);
    const env = freshLocalEnv({ NVIDIA_API_KEY: "nv", NEBIUS_API_KEY: "" });
    const r = await rankPassages(env, "fingerprints at the voivodeship office", passages, 1, "nvidia");
    expect(r.provider).toBe("lexical");
    expect(r.ranked[0].id).toBe("2");
  });
});
