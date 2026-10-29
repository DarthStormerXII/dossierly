/*
 * Passage ranking for the hub. Public page text only (never user data) may use NVIDIA's hosted
 * Nemotron embeddings; Qwen3-Embedding-8B on Token Factory is the fallback; if both fail, a
 * lexical overlap score keeps retrieval working. Vectors are cached in KV per provider+text hash.
 */
import { EMBEDDING_MODEL, NVIDIA_BASE_URL, NVIDIA_EMBEDDING_MODEL } from "../config";
import { embeddingCostUsd } from "../model/cost";
import { embedTokenFactory } from "../model/tokenfactory";
import type { Env } from "../server/env";
import { checkAndSpend } from "../server/budget";
import { recordLedger } from "../server/ledger";
import { b64ToVec, cosine, shortHash, vecToB64 } from "./util";

export type EmbedProvider = "nvidia" | "qwen" | "lexical";
export interface Passage {
  id: string;
  url: string;
  title: string;
  text: string;
}
export interface Ranked extends Passage {
  score: number;
}

const CACHE_TTL = 30 * 24 * 3600;

async function embedNvidia(env: Env, inputs: string[], type: "query" | "passage"): Promise<number[][]> {
  const res = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: NVIDIA_EMBEDDING_MODEL, input: inputs, input_type: type, encoding_format: "float", truncate: "END" }),
  });
  if (!res.ok) throw new Error(`nvidia embeddings ${res.status}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function embedBatch(env: Env, provider: "nvidia" | "qwen", inputs: string[], type: "query" | "passage"): Promise<number[][]> {
  const bytes = inputs.reduce((n, s) => n + s.length, 0);
  if (provider === "nvidia") {
    const out = await embedNvidia(env, inputs, type);
    await recordLedger(env, { userId: null, kind: "egress", what: NVIDIA_EMBEDDING_MODEL, region: "integrate.api.nvidia.com", action: "allowed", bytes, masked: 0, detail: { public: true } }).catch(() => undefined);
    return out;
  }
  const est = embeddingCostUsd(Math.ceil(bytes / 3));
  if (!(await checkAndSpend(env, "tf_usd", est))) throw new Error("over budget");
  const { vectors } = await embedTokenFactory(env.NEBIUS_API_KEY, inputs);
  await recordLedger(env, { userId: null, kind: "model", what: EMBEDDING_MODEL, action: "allowed", bytes, masked: 0, detail: { public: true } }).catch(() => undefined);
  return vectors;
}

async function embedCached(env: Env, provider: "nvidia" | "qwen", texts: string[], type: "query" | "passage"): Promise<Float32Array[]> {
  const keys = await Promise.all(texts.map(async (t) => `emb:${provider}:${type}:${await shortHash(t)}`));
  const found = await Promise.all(keys.map((k) => env.CACHE.get(k)));
  const out: Array<Float32Array | null> = found.map((v) => (v ? b64ToVec(v) : null));
  const todo = out.flatMap((v, i) => (v ? [] : [i]));
  const batches: number[][] = [];
  for (let s = 0; s < todo.length; s += 16) batches.push(todo.slice(s, s + 16));
  await Promise.all(
    batches.map(async (slice) => {
      const vecs = await embedBatch(env, provider, slice.map((i) => texts[i]), type);
      await Promise.all(
        slice.map(async (i, j) => {
          const f = Float32Array.from(vecs[j]);
          out[i] = f;
          await env.CACHE.put(keys[i], vecToB64(f), { expirationTtl: CACHE_TTL });
        }),
      );
    }),
  );
  return out as Float32Array[];
}

const tokens = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

export function lexicalRank(query: string, passages: Passage[], k: number): Ranked[] {
  const q = tokens(query);
  return passages
    .map((p) => {
      const t = tokens(p.text);
      let hit = 0;
      for (const w of q) if (t.has(w)) hit++;
      return { ...p, score: q.size ? hit / q.size : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function embedOrder(prefer?: string): Array<"nvidia" | "qwen"> {
  return prefer === "qwen" ? ["qwen"] : prefer === "nvidia-only" ? ["nvidia"] : ["nvidia", "qwen"];
}

/** Cosine top-k over public passages. `provider` reports which path actually worked. */
export async function rankPassages(
  env: Env,
  query: string,
  passages: Passage[],
  k: number,
  prefer = process.env.HUB_EMBED,
): Promise<{ ranked: Ranked[]; provider: EmbedProvider }> {
  if (!passages.length) return { ranked: [], provider: "lexical" };
  for (const provider of embedOrder(prefer)) {
    if (provider === "nvidia" && !env.NVIDIA_API_KEY) continue;
    if (provider === "qwen" && !env.NEBIUS_API_KEY) continue;
    try {
      const [qv] = await embedCached(env, provider, [query], "query");
      const pv = await embedCached(env, provider, passages.map((p) => p.text), "passage");
      const ranked = passages
        .map((p, i) => ({ ...p, score: cosine(qv, pv[i]) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
      return { ranked, provider };
    } catch {
      /* try the next provider */
    }
  }
  return { ranked: lexicalRank(query, passages, k), provider: "lexical" };
}
