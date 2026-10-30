import type { Env } from "./env";
import { ApiError } from "./http";
import { mePayload } from "./me";
import { rateLimit } from "./ratelimit";
import { loadUserState } from "./session";

/** Unauthenticated endpoints are limited per client IP, inside that key's Durable Object. */
export async function limitAuth(env: Env, req: Request, bucket: string, limit = 30): Promise<void> {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(env, `ip:${ip}`, bucket, limit, 60);
  if (!rl.ok) throw new ApiError(429, "Too many attempts. Try again in a minute.", "rate_limited");
}

/** Response for a successful sign-up or sign-in: the me payload plus the session cookie. */
export async function authResponse(env: Env, userId: string, cookie: string): Promise<Response> {
  const state = await loadUserState(env, userId);
  if (!state) throw new ApiError(500, "Could not load your account", "internal");
  return Response.json(mePayload(state), { headers: { "set-cookie": cookie, "cache-control": "no-store" } });
}
