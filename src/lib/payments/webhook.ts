import { b64url, fromBase64, hmacSha256, timingSafeEqual } from "@/lib/server/util";

export const TOLERANCE_SEC = 300;

export type VerifyResult = { ok: true } | { ok: false; reason: "missing_headers" | "bad_timestamp" | "stale" | "bad_signature" | "no_key" };

/**
 * Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` keyed by the
 * base64 secret (after the `whsec_` prefix); header holds space-separated `v1,<sig>`.
 */
export async function verifyWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  key: string,
  nowMs = Date.now(),
): Promise<VerifyResult> {
  if (!key) return { ok: false, reason: "no_key" };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(nowMs / 1000 - ts) > TOLERANCE_SEC) return { ok: false, reason: "stale" };
  let keyBytes: Uint8Array;
  try {
    keyBytes = fromBase64(key.startsWith("whsec_") ? key.slice(6) : key);
  } catch {
    return { ok: false, reason: "no_key" };
  }
  const expected = b64url(await hmacSha256(keyBytes, `${id}.${timestamp}.${rawBody}`));
  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",");
    if (version === "v1" && sig && timingSafeEqual(sig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "bad_signature" };
}
