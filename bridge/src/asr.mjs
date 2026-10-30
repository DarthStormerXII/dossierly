import { sleep } from "./shell.mjs";

export const ASR_MODEL = "nvidia/parakeet-tdt-0.6b-v3";
export const TRANSLATE_MODEL = "nvidia/canary-1b-v2";
const LOCAL = "http://127.0.0.1:8091";
const CANARY = "http://127.0.0.1:8092";
const LANGS = new Set(["pl", "en", "uk"]);

/**
 * Speech-recognition loop. Independent of the task loop: it polls the Worker for audio,
 * runs it through the local Parakeet server and posts the transcript back. Outbound only.
 * Never logs audio or transcript text.
 */
export function createAsrLoop(cfg, log, { fetchImpl = fetch, local = LOCAL, canary = CANARY, intervalMs = 400, errorMs = 2000, warmMs = 6000 } = {}) {
  const headers = { "x-bridge-secret": cfg.secret };
  let stopping = false;
  let quiet = false; // log an outage once, not every poll

  async function post(path, body) {
    const res = await fetchImpl(`${cfg.url}${path}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  }

  async function recognise(job) {
    const audio = Buffer.from(String(job.audio ?? ""), "base64");
    const res = await fetchImpl(`${local}/transcribe`, {
      method: "POST",
      headers: { "content-type": "audio/wav" },
      body: audio,
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { id: job.id, ok: false, error: String(body.error ?? `asr ${res.status}`).slice(0, 200), ms: 0, model: ASR_MODEL };
    const out = { id: job.id, ok: true, text: String(body.text ?? ""), ms: Number(body.ms ?? 0), model: ASR_MODEL };
    if (LANGS.has(job.translate) && LANGS.has(job.lang) && job.translate !== job.lang) {
      const tr = await translate(audio, job.lang, job.translate);
      if (tr) Object.assign(out, tr);
    }
    return out;
  }

  /** Canary speech translation; a failure leaves the transcript intact and just omits the translation. */
  async function translate(audio, src, tgt) {
    try {
      const res = await fetchImpl(`${canary}/translate?src=${src}&tgt=${tgt}`, {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: audio,
        signal: AbortSignal.timeout(60_000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.text !== "string") return null;
      return { translation: body.text, translationMs: Number(body.ms ?? 0), translationModel: TRANSLATE_MODEL };
    } catch {
      return null;
    }
  }

  /** One poll. Resolves true when a job was handled, false when idle; throws on transport errors. */
  async function tick() {
    const res = await fetchImpl(`${cfg.url}/api/bridge/asr-next`, { headers, signal: AbortSignal.timeout(20_000) });
    if (res.status === 204) return false;
    if (!res.ok) throw new Error(`GET /api/bridge/asr-next -> ${res.status}`);
    const job = await res.json();
    if (!job?.id) return false;
    let payload;
    try {
      payload = await recognise(job);
    } catch (e) {
      payload = { id: job.id, ok: false, error: `asr unavailable: ${e.name}`, ms: 0, model: ASR_MODEL };
    }
    await post("/api/bridge/asr-result", payload);
    log("asr", job.id, payload.ok ? "done" : "failed", `${payload.ms}ms`);
    return true;
  }

  // The host is short of memory, so idle model weights get paged out and the next call takes ~20 s instead of ~1 s.
  // A tiny silent clip through both models every few seconds while idle keeps their weights resident.
  const silence = (() => {
    const n = 8000; // 0.5 s at 16 kHz
    const b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
    b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
    return b;
  })();
  let lastUse = 0;
  async function keepWarm() {
    if (warmMs <= 0 || Date.now() - lastUse < warmMs) return;
    lastUse = Date.now();
    await Promise.allSettled([
      fetchImpl(`${local}/transcribe`, { method: "POST", body: silence, signal: AbortSignal.timeout(30_000) }),
      fetchImpl(`${canary}/translate?src=pl&tgt=en`, { method: "POST", body: silence, signal: AbortSignal.timeout(30_000) }),
    ]);
  }

  async function run() {
    while (!stopping) {
      let wait = intervalMs;
      try {
        if (await tick()) lastUse = Date.now();
        else await keepWarm();
        quiet = false;
      } catch (e) {
        if (!quiet) log("asr poll failed:", e.message);
        quiet = true;
        wait = errorMs;
      }
      await sleep(wait);
    }
  }

  return { tick, run, stop: () => { stopping = true; } };
}
