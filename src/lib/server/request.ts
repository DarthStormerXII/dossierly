import type { Env } from "./env";
import { ApiError } from "./http";

export function sameOrigin(req: Request, env: Env): void {
  const origin = req.headers.get("origin");
  if (!origin && env.APP_ENV === "local") return;
  if (!origin || origin !== new URL(env.APP_URL).origin || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "This request must come from Dossierly", "invalid_origin");
  }
}

export async function boundedJson<T>(req: Request, schema: { parse(value: unknown): T }, maxBytes = 16_384): Promise<T> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Use a JSON request", "invalid_content_type");
  }
  if (Number(req.headers.get("content-length")) > maxBytes) throw new ApiError(413, "Request is too large", "too_large");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Request body must be JSON", "invalid_json");
  const parts: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new ApiError(413, "Request is too large", "too_large"); }
    parts.push(value);
  }
  const joined = new Uint8Array(size); let at = 0;
  for (const part of parts) { joined.set(part, at); at += part.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(joined)); }
  catch { throw new ApiError(400, "Request body must be JSON", "invalid_json"); }
  return schema.parse(body);
}
