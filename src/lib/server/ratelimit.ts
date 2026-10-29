import type { Env } from "./env";

/** Per-user sliding-window limit enforced inside that user's Durable Object. */
export async function rateLimit(env: Env, userId: string, key: string, limit: number, windowSec: number) {
  const stub = env.USER_DO.get(env.USER_DO.idFromName(userId));
  const res = await stub.fetch("https://user.do/rate", {
    method: "POST",
    body: JSON.stringify({ key, limit, windowSec }),
  });
  return (await res.json()) as { ok: boolean; remaining: number; retryAfterSec: number };
}
