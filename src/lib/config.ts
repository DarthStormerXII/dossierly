import type { Language } from "./schemas";

/** Every model task, each mapped to exactly one Token Factory model ID below. */
export type ModelTask =
  | "intro"
  | "interpret"
  | "interpret_ml"
  | "guard_ml"
  | "guard"
  | "watch"
  | "wrap"
  | "read"
  | "link"
  | "link_fallback"
  | "hub_summary"
  | "prepare";

export type ModelKey = "lightning" | "superVl" | "ultra";

/** The only place model IDs live. Never Super-120B or Nano-30B (removed 9 Nov). */
export const MODEL_IDS: Record<ModelKey, string> = {
  lightning: "nvidia/Nemotron-3_5-Lightning",
  superVl: "nvidia/Nemotron-3.5-Super-VL",
  ultra: "nvidia/Nemotron-3-Ultra-550b-a55b",
};
export const EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-8B";
/** Optional public-text embeddings on NVIDIA's hosted API (ID verified against GET /v1/models). */
export const NVIDIA_EMBEDDING_MODEL = "nvidia/nemotron-3.5-embed-1b";
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export const MODEL_TABLE: Record<ModelTask, ModelKey> = {
  intro: "lightning",
  interpret: "lightning",
  guard: "lightning",
  // Measured 30 Oct (docs/model-checks.md): Lightning garbles Hindi, Tamil and Ukrainian; Super VL is correct at +100-200 ms.
  interpret_ml: "superVl",
  guard_ml: "superVl",
  hub_summary: "lightning",
  watch: "superVl",
  wrap: "superVl",
  read: "superVl",
  prepare: "superVl",
  link: "ultra",
  link_fallback: "superVl",
};

/** Used once if a model returns 404 (it can vanish from Token Factory for hours and come back). Text tasks only. */
export const FALLBACK_MODEL: Partial<Record<ModelKey, ModelKey>> = { lightning: "superVl", superVl: "ultra", ultra: "superVl" };

/** List prices, USD per million tokens: input, cached input, output. */
export const PRICES: Record<ModelKey, { in: number; cached: number; out: number }> = {
  lightning: { in: 0.06, cached: 0.03, out: 0.24 },
  superVl: { in: 0.3, cached: 0.06, out: 0.9 },
  ultra: { in: 1.0, cached: 0.12, out: 3.0 },
};
export const EMBEDDING_PRICE_PER_M = 0.01;

export const TOKENFACTORY_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";

export const modelIdFor = (task: ModelTask) => MODEL_IDS[MODEL_TABLE[task]];
export const keyForModelId = (id: string): ModelKey =>
  (Object.keys(MODEL_IDS) as ModelKey[]).find((k) => MODEL_IDS[k] === id) ?? "lightning";

export const LANGUAGE_META: Record<
  Language,
  { label: string; native: string; english: string; recognition: string; speech: string }
> = {
  en: { label: "English", native: "English", english: "English", recognition: "en-IN", speech: "en-IN" },
  uk: { label: "Ukrainian", native: "Українська", english: "Ukrainian", recognition: "uk-UA", speech: "uk-UA" },
  hi: { label: "Hindi", native: "हिन्दी", english: "Hindi", recognition: "hi-IN", speech: "hi-IN" },
  ta: { label: "Tamil", native: "தமிழ்", english: "Tamil", recognition: "ta-IN", speech: "ta-IN" },
};

export const POLISH = { recognition: "pl-PL", speech: "pl-PL" };

/** Hub domains Tavily may search; see docs/BUILD.md. */
export const HUB_DOMAINS = [
  "gov.pl",
  "udsc.gov.pl",
  "migrant.wsc.mazowieckie.pl",
  "mazowieckie.uw.gov.pl",
  "mos.cudzoziemcy.gov.pl",
];

export const HUB_LIMITS = {
  tavilyCreditsPerDay: 5,
  kvTtlSeconds: 7 * 24 * 3600,
  /** The demo set (sources.json + demo queries) is cached with no TTL. */
  topK: 6,
  chunkChars: 900,
};
