/*
 * Tavily over plain fetch. @tavily/core pulls in axios, whose Node http adapter is unreliable on
 * Cloudflare Workers; the REST calls are the same (POST /search, POST /extract, Bearer key).
 * Every call is cached in KV by normalised query/URL, budgeted with checkAndSpend("tavily_credits"),
 * and written to the ledger. Never call on page load.
 */
import { HUB_DOMAINS, HUB_LIMITS } from "../config";
import { Masker } from "../mask";
import type { Env } from "../server/env";
import { checkAndSpend } from "../server/budget";
import { recordLedger } from "../server/ledger";
import { normQuery, normUrl, shortHash } from "./util";

const API = "https://api.tavily.com";

export interface SearchHit {
  title: string;
  url: string;
  content: string;
  score: number;
}
export interface Page {
  url: string;
  text: string;
}
export type Origin = "cache" | "live" | "budget" | "no_key";

export interface CacheOpts {
  userId?: string | null;
  /** Demo-set entries never expire; everything else keeps for 7 days. */
  demo?: boolean;
}

async function post(env: Env, path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

const putCache = (env: Env, key: string, value: unknown, demo?: boolean) =>
  env.CACHE.put(key, JSON.stringify(value), demo ? undefined : { expirationTtl: HUB_LIMITS.kvTtlSeconds });

async function ledger(env: Env, userId: string | null, what: string, action: "allowed" | "denied", bytes: number, masked: number) {
  try {
    await recordLedger(env, { userId, kind: "egress", what, region: "api.tavily.com", action, bytes, masked });
  } catch {
    /* bookkeeping must not fail the request */
  }
}

export async function cachedSearch(env: Env, query: string, opts: CacheOpts = {}): Promise<{ hits: SearchHit[]; origin: Origin }> {
  const masker = new Masker();
  const q = masker.mask(query);
  const key = `tav:s:${await shortHash(normQuery(q) + "|" + HUB_DOMAINS.join(","))}`;
  const hit = await env.CACHE.get(key);
  if (hit) return { hits: JSON.parse(hit) as SearchHit[], origin: "cache" };
  if (!env.TAVILY_API_KEY) return { hits: [], origin: "no_key" };
  const userId = opts.userId ?? null;
  if (!(await checkAndSpend(env, "tavily_credits", 1, { userId: userId ?? undefined }))) {
    await ledger(env, userId, "tavily search", "denied", q.length, masker.count);
    return { hits: [], origin: "budget" };
  }
  const json = await post(env, "/search", { query: q, include_domains: HUB_DOMAINS, max_results: 5, search_depth: "basic" });
  await ledger(env, userId, "tavily search", "allowed", q.length, masker.count);
  const hits = ((json?.results as SearchHit[] | undefined) ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content, score: r.score }));
  if (hits.length) await putCache(env, key, hits, opts.demo);
  return { hits, origin: "live" };
}

/** Extract pages, one KV entry per URL. Live extraction costs 1 credit per 5 URLs. */
export async function cachedExtract(env: Env, urls: string[], opts: CacheOpts = {}): Promise<{ pages: Page[]; origin: Origin }> {
  const pages: Page[] = [];
  const missing: string[] = [];
  for (const u of urls) {
    const hit = await env.CACHE.get(`tav:e:${await shortHash(normUrl(u))}`);
    if (hit) pages.push({ url: u, text: hit });
    else missing.push(u);
  }
  if (!missing.length) return { pages, origin: "cache" };
  if (!env.TAVILY_API_KEY) return { pages, origin: "no_key" };
  const userId = opts.userId ?? null;
  const credits = Math.ceil(missing.length / 5);
  if (!(await checkAndSpend(env, "tavily_credits", credits, { userId: userId ?? undefined }))) {
    await ledger(env, userId, "tavily extract", "denied", missing.join(",").length, 0);
    return { pages, origin: pages.length ? "cache" : "budget" };
  }
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const json = await post(env, "/extract", { urls: batch, extract_depth: "basic", format: "markdown" });
    await ledger(env, userId, "tavily extract", "allowed", batch.join(",").length, 0);
    for (const r of (json?.results as Array<{ url: string; raw_content: string }> | undefined) ?? []) {
      if (!r.raw_content) continue;
      pages.push({ url: r.url, text: r.raw_content });
      await putCache(env, `tav:e:${await shortHash(normUrl(r.url))}`, r.raw_content, opts.demo);
    }
  }
  return { pages, origin: "live" };
}

/** Always-live extraction for the nightly watch (no read-through cache), still budgeted and logged. */
export async function liveExtract(env: Env, urls: string[]): Promise<Page[]> {
  if (!env.TAVILY_API_KEY || !urls.length) return [];
  const out: Page[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    if (!(await checkAndSpend(env, "tavily_credits", 1))) {
      await ledger(env, null, "tavily extract", "denied", batch.join(",").length, 0);
      break;
    }
    const json = await post(env, "/extract", { urls: batch, extract_depth: "basic", format: "markdown" });
    await ledger(env, null, "tavily extract", "allowed", batch.join(",").length, 0);
    for (const r of (json?.results as Array<{ url: string; raw_content: string }> | undefined) ?? []) {
      if (r.raw_content) out.push({ url: r.url, text: r.raw_content });
    }
  }
  return out;
}
