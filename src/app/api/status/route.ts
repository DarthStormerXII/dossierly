import { ASR_MODEL, asrOnline } from "@/lib/server/asr";
import { getBudgets } from "@/lib/server/budget";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 60_000;
export const MODELS = [
  { id: "nvidia/Nemotron-3_5-Lightning", role: "turns, guard, summaries" },
  { id: "nvidia/Nemotron-3.5-Super-VL", role: "agent, vision, watcher, drafts" },
  { id: "nvidia/Nemotron-3-Ultra-550b-a55b", role: "whole-case reasoning" },
];

/** The bridge writes `bridge:lastSeen` (epoch ms or ISO) and optionally `bridge:sandboxes` (integer) to KV. */
function parseTime(v: string | null): number | null {
  if (!v) return null;
  const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const env = getEnv();
    const [seenRaw, sandboxesRaw, budgets, asr] = await Promise.all([
      env.CACHE.get("bridge:lastSeen"),
      env.CACHE.get("bridge:sandboxes"),
      getBudgets(env),
      asrOnline(env),
    ]);
    const seen = parseTime(seenRaw);
    const sandboxes = Number(sandboxesRaw);
    return Response.json({
      models: MODELS.map((m) => ({ ...m, ready: !!env.NEBIUS_API_KEY })),
      bridge: {
        online: seen !== null && Date.now() - seen < ONLINE_WINDOW_MS,
        lastSeen: seen ? new Date(seen).toISOString() : null,
        sandboxes: Number.isFinite(sandboxes) ? sandboxes : 0,
      },
      budgets,
      asr: { online: asr, model: ASR_MODEL },
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
