const enc = new TextEncoder();

export function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(input: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

export async function hmacSha256(key: Uint8Array | string, data: string): Promise<Uint8Array> {
  const raw = typeof key === "string" ? enc.encode(key) : key;
  const k = await crypto.subtle.importKey("raw", raw as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function randomId(prefix: string, bytes = 12): string {
  return `${prefix}_${b64url(crypto.getRandomValues(new Uint8Array(bytes)))}`;
}

export const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10);
