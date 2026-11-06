import type { KVLike } from "./env";

/**
 * KV writes are billed (1M a month included, then $5 per million). The bridge polls every ~2 s and the
 * speech loop every ~0.4 s, so writing a heartbeat on every poll cost ~150k writes a day while idle.
 * Readers only need "seen recently", so each isolate writes a heartbeat at most once per interval and
 * other values only when they change.
 */
export const HEARTBEAT_EVERY_MS = 15_000;
/** Heartbeat interval + a ~20 s cold transcription with no polls + KV's up-to-60 s cross-location staleness. */
export const HEARTBEAT_ONLINE_MS = 90_000;
/** Rewrite unchanged values occasionally so a value another isolate overwrote heals itself. */
const UNCHANGED_REFRESH_MS = 10 * 60_000;

type Written = { value: string; at: number };
const memo = new WeakMap<KVLike, Map<string, Written>>();

function writtenFor(kv: KVLike): Map<string, Written> {
  let m = memo.get(kv);
  if (!m) memo.set(kv, (m = new Map()));
  return m;
}

/** Records `now` under `key` unless this isolate already did so within HEARTBEAT_EVERY_MS. Resolves true when it wrote. */
export async function touchHeartbeat(kv: KVLike, key: string, now = Date.now()): Promise<boolean> {
  const written = writtenFor(kv);
  const prev = written.get(key);
  if (prev && now >= prev.at && now - prev.at < HEARTBEAT_EVERY_MS) return false;
  await kv.put(key, String(now));
  written.set(key, { value: String(now), at: now });
  return true;
}

/** Writes `value` under `key` only when it differs from what this isolate last wrote (or that write is stale). */
export async function putIfChanged(kv: KVLike, key: string, value: string, now = Date.now()): Promise<boolean> {
  const written = writtenFor(kv);
  const prev = written.get(key);
  if (prev && prev.value === value && now >= prev.at && now - prev.at < UNCHANGED_REFRESH_MS) return false;
  await kv.put(key, value);
  written.set(key, { value, at: now });
  return true;
}
