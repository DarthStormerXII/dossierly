import { describe, expect, it } from "vitest";
import {
  ASR_MAX_AUDIO, ASR_QUEUE_MS, ASR_TIMEOUT_ERROR, claimAsrJob, createAsrJob, finishAsrJob, getAsrJob,
} from "@/lib/server/asr";
import { ApiError } from "@/lib/server/http";
import { listLedger } from "@/lib/server/ledger";
import { freshLocalEnv } from "@/lib/server/local";

const wav = () => {
  const head = new Uint8Array(44);
  head.set([...new TextEncoder().encode("RIFF")], 0);
  head.set([...new TextEncoder().encode("WAVE")], 8);
  return btoa(String.fromCharCode(...head));
};
const code = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e instanceof ApiError ? [e.status, e.code] : String(e); }
  return null;
};
const online = (env: ReturnType<typeof freshLocalEnv>, now: number) => env.CACHE.put("asr:lastSeen", String(now));

describe("asr jobs", () => {
  it("is 503 asr_offline when the bridge has not been seen for a minute", async () => {
    const env = freshLocalEnv();
    expect(await code(createAsrJob(env, "u1", { audio: wav(), lang: "pl" }, 100_000))).toEqual([503, "asr_offline"]);
    await online(env, 30_000);
    expect(await code(createAsrJob(env, "u1", { audio: wav(), lang: "pl" }, 100_000))).toEqual([503, "asr_offline"]);
    await online(env, 90_000);
    expect(await code(createAsrJob(env, "u1", { audio: wav(), lang: "pl" }, 100_000))).toBeNull();
  });

  it("rejects oversized and non-WAV audio", async () => {
    const env = freshLocalEnv();
    await online(env, Date.now());
    expect(await code(createAsrJob(env, "u1", { audio: "A".repeat(ASR_MAX_AUDIO + 1), lang: "en" }))).toEqual([413, "too_large"]);
    expect(await code(createAsrJob(env, "u1", { audio: btoa("not a wav at all"), lang: "en" }))).toEqual([400, "invalid_audio"]);
  });

  it("claim -> result nulls the audio, stores the translation and ledgers both models", async () => {
    const env = freshLocalEnv();
    const now = Date.now();
    await online(env, now);
    const { id } = await createAsrJob(env, "u1", { audio: wav(), lang: "pl", translate: "en" }, now);
    const claimed = await claimAsrJob(env, now + 10);
    expect(claimed).toMatchObject({ id, lang: "pl", translate: "en" });
    expect(claimed?.audio).toBe(wav());
    expect(await claimAsrJob(env, now + 11)).toBeNull();
    expect((await getAsrJob(env, "u1", id, now + 12)).status).toBe("running");
    await finishAsrJob(env, { id, ok: true, text: "Dzień dobry", ms: 420, model: "nvidia/parakeet-tdt-0.6b-v3", translation: "Good day", translationModel: "nvidia/Nemotron-3.5-Lightning" }, now + 500);
    const row = await env.DB.prepare("SELECT audio, status FROM asr_jobs WHERE id = ?").bind(id).first<{ audio: string | null; status: string }>();
    expect(row).toEqual({ audio: null, status: "done" });
    expect(await getAsrJob(env, "u1", id, now + 600)).toEqual({
      status: "done", text: "Dzień dobry", ms: 420, model: "nvidia/parakeet-tdt-0.6b-v3",
      translation: "Good day", translationModel: "nvidia/Nemotron-3.5-Lightning",
    });
    const ledger = JSON.stringify(await listLedger(env, "u1", 50));
    expect(ledger).toContain("parakeet-tdt-0.6b-v3");
    expect(ledger).toContain("Nemotron-3.5-Lightning");
  });

  it("a failed result records the error and still drops the audio", async () => {
    const env = freshLocalEnv();
    const now = Date.now();
    await online(env, now);
    const { id } = await createAsrJob(env, "u1", { audio: wav(), lang: "en" }, now);
    await claimAsrJob(env, now + 1);
    await finishAsrJob(env, { id, ok: false, error: "decode failed", ms: 10, model: "nvidia/parakeet-tdt-0.6b-v3" }, now + 2);
    expect(await getAsrJob(env, "u1", id, now + 3)).toMatchObject({ status: "failed", error: "decode failed" });
    const row = await env.DB.prepare("SELECT audio FROM asr_jobs WHERE id = ?").bind(id).first<{ audio: string | null }>();
    expect(row?.audio).toBeNull();
  });

  it("only the owner can read a job", async () => {
    const env = freshLocalEnv();
    const now = Date.now();
    await online(env, now);
    const { id } = await createAsrJob(env, "u1", { audio: wav(), lang: "en" }, now);
    expect(await code(getAsrJob(env, "u2", id, now))).toEqual([404, "not_found"]);
    expect(await code(getAsrJob(env, "u1", "asr_missing", now))).toEqual([404, "not_found"]);
    expect((await getAsrJob(env, "u1", id, now)).status).toBe("queued");
  });

  it("fails a job still queued after 20 s and never hands it to the bridge", async () => {
    const env = freshLocalEnv();
    const now = Date.now();
    await online(env, now);
    const { id } = await createAsrJob(env, "u1", { audio: wav(), lang: "en" }, now);
    expect(await claimAsrJob(env, now + ASR_QUEUE_MS + 1)).toBeNull();
    expect(await getAsrJob(env, "u1", id, now + ASR_QUEUE_MS + 1)).toEqual({ status: "failed", error: ASR_TIMEOUT_ERROR });
    const row = await env.DB.prepare("SELECT audio FROM asr_jobs WHERE id = ?").bind(id).first<{ audio: string | null }>();
    expect(row?.audio).toBeNull();
  });
});
