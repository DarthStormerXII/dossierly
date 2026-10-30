import { z } from "zod";
import type { Env } from "./env";
import { ApiError } from "./http";
import { recordLedger } from "./ledger";
import { randomId } from "./util";

export const ASR_MODEL = "nvidia/parakeet-tdt-0.6b-v3";
/** The bridge does not poll while it transcribes, and cold calls can take ~20 s, so allow a minute of silence. */
export const ASR_ONLINE_MS = 60_000;
export const ASR_QUEUE_MS = 20_000;
export const ASR_RUN_MS = 60_000;
export const ASR_MAX_AUDIO = 1_000_000;
export const ASR_TIMEOUT_ERROR = "The speech service did not answer";

export const AsrStartSchema = z.object({
  audio: z.string().min(1),
  lang: z.enum(["pl", "en", "uk", "hi", "ta"]),
  translate: z.enum(["en", "pl"]).optional(),
});
export const AsrResultSchema = z.object({
  id: z.string().min(1).max(64),
  ok: z.boolean(),
  text: z.string().max(4000).optional(),
  error: z.string().max(300).optional(),
  ms: z.number().finite().nonnegative(),
  model: z.string().min(1).max(120),
  translation: z.string().max(4000).optional(),
  translationModel: z.string().min(1).max(120).optional(),
});

export type AsrStatus = "queued" | "running" | "done" | "failed";
export type AsrView = {
  status: AsrStatus; text?: string; error?: string; ms?: number; model?: string; translation?: string; translationModel?: string;
};
type Row = {
  id: string; user_id: string; status: AsrStatus; text: string | null; error: string | null;
  model: string | null; ms: number | null; translation: string | null; translation_model: string | null; created_at: number; updated_at: number;
};

export async function asrOnline(env: Env, now = Date.now()): Promise<boolean> {
  const seen = Number(await env.CACHE.get("asr:lastSeen"));
  return Number.isFinite(seen) && seen > 0 && now - seen < ASR_ONLINE_MS;
}

/** A WAV starts with `RIFF....WAVE`; reject anything else before it reaches the agent host. */
function looksLikeWav(b64: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  try {
    const head = atob(b64.slice(0, 16));
    return head.startsWith("RIFF") && head.slice(8, 12) === "WAVE";
  } catch {
    return false;
  }
}

/** Queues one transcription. Throws 413 `too_large`, 400 `invalid_audio`, 503 `asr_offline`. */
export async function createAsrJob(env: Env, userId: string, input: z.infer<typeof AsrStartSchema>, now = Date.now()): Promise<{ id: string }> {
  if (input.audio.length > ASR_MAX_AUDIO) throw new ApiError(413, "That recording is too long. Try a shorter clip.", "too_large");
  if (!looksLikeWav(input.audio)) throw new ApiError(400, "Audio must be a base64 WAV", "invalid_audio");
  if (!(await asrOnline(env, now))) throw new ApiError(503, "Speech recognition is offline right now", "asr_offline");
  const id = randomId("asr_");
  await env.DB.prepare("INSERT INTO asr_jobs (id, user_id, lang, audio, translate, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)")
    .bind(id, userId, input.lang, input.audio, input.translate ?? null, now, now).run();
  return { id };
}

const failStale = (env: Env, id: string, now: number) =>
  env.DB.prepare(
    "UPDATE asr_jobs SET status='failed', error=?, audio=NULL, updated_at=? WHERE id=? AND ((status='queued' AND created_at<?) OR (status='running' AND updated_at<?))",
  ).bind(ASR_TIMEOUT_ERROR, now, id, now - ASR_QUEUE_MS, now - ASR_RUN_MS).run();

/** Owner-only status. A job nobody picked up in 20 s (or a run silent for 60 s) is failed on read. */
export async function getAsrJob(env: Env, userId: string, id: string, now = Date.now()): Promise<AsrView> {
  await failStale(env, id, now);
  const row = await env.DB.prepare("SELECT id, user_id, status, text, error, model, ms, translation, translation_model, created_at, updated_at FROM asr_jobs WHERE id = ?")
    .bind(id).first<Row>();
  if (!row || row.user_id !== userId) throw new ApiError(404, "Not found", "not_found");
  const view: AsrView = { status: row.status };
  if (row.text !== null) view.text = row.text;
  if (row.error !== null) view.error = row.error;
  if (row.ms !== null) view.ms = row.ms;
  if (row.model !== null) view.model = row.model;
  if (row.translation !== null) view.translation = row.translation;
  if (row.translation_model !== null) view.translationModel = row.translation_model;
  return view;
}

/** Marks the bridge online and atomically claims the oldest fresh queued job, or null. */
export async function claimAsrJob(env: Env, now = Date.now()): Promise<{ id: string; lang: string; audio: string; translate: string | null } | null> {
  await env.CACHE.put("asr:lastSeen", String(now));
  return env.DB.prepare(
    `UPDATE asr_jobs SET status='running', updated_at=?
     WHERE status='queued' AND id = (SELECT id FROM asr_jobs WHERE status='queued' AND created_at>=? ORDER BY created_at LIMIT 1)
     RETURNING id, lang, audio, translate`,
  ).bind(now, now - ASR_QUEUE_MS).first<{ id: string; lang: string; audio: string; translate: string | null }>();
}

/** Stores the transcript, drops the audio, and ledgers the model call for the job's user. */
export async function finishAsrJob(env: Env, r: z.infer<typeof AsrResultSchema>, now = Date.now()): Promise<void> {
  const row = await env.DB.prepare("SELECT user_id, status FROM asr_jobs WHERE id = ?").bind(r.id).first<{ user_id: string; status: AsrStatus }>();
  if (!row) throw new ApiError(404, "Unknown job", "not_found");
  if (row.status === "done" || row.status === "failed") return;
  const done = r.ok && typeof r.text === "string";
  await env.DB.prepare("UPDATE asr_jobs SET status=?, text=?, error=?, model=?, ms=?, translation=?, translation_model=?, audio=NULL, updated_at=? WHERE id=? AND status IN ('queued','running')")
    .bind(done ? "done" : "failed", done ? r.text : null, done ? null : (r.error ?? "Transcription failed"), r.model, Math.round(r.ms), done ? (r.translation ?? null) : null, done ? (r.translationModel ?? null) : null, now, r.id).run();
  await recordLedger(env, {
    userId: row.user_id, kind: "model", what: r.model, action: "allowed",
    detail: { task: "asr", ranOn: "agent host" },
  });
  if (done && r.translation && r.translationModel) {
    await recordLedger(env, {
      userId: row.user_id, kind: "model", what: r.translationModel, action: "allowed",
      detail: { task: "asr-translate", ranOn: "agent host" },
    });
  }
}
