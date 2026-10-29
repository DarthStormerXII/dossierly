import { getEnv, type Env } from "./env";
import { ApiError } from "./http";
import { b64url, hmacSha256, randomId, timingSafeEqual } from "./util";

export const SESSION_COOKIE = "settla_uid";
const MAX_AGE = 60 * 60 * 24 * 400;

export type PlanKind = "free" | "case_pass" | "judge";
export type Plan = { kind: PlanKind; creditsLeft: number; expiresAt?: string | null; family?: boolean };
export type UserState = { userId: string; plan: Plan; freeLetterUsed: boolean };

async function sign(env: Env, userId: string): Promise<string> {
  if (!env.SESSION_SECRET) throw new ApiError(503, "Sessions are not configured", "session_unconfigured");
  return b64url(await hmacSha256(env.SESSION_SECRET, `uid:${userId}`));
}

function cookieHeader(env: Env, value: string): string {
  const secure = env.APP_ENV === "local" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export async function userIdFromRequest(req: Request, env: Env): Promise<string | null> {
  const raw = req.headers.get("cookie") ?? "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!m) return null;
  const value = m.slice(SESSION_COOKIE.length + 1);
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = value.slice(0, dot);
  return timingSafeEqual(value.slice(dot + 1), await sign(env, userId)) ? userId : null;
}

/** Resolve plan from the user row; expired passes fall back to free. */
export async function loadUserState(env: Env, userId: string): Promise<UserState | null> {
  const row = await env.DB.prepare(
    "SELECT plan_kind, plan_expires_at, credits, family, free_letter_used FROM users WHERE id = ?",
  ).bind(userId).first<{ plan_kind: PlanKind; plan_expires_at: number | null; credits: number; family: number; free_letter_used: number }>();
  if (!row) return null;
  const expired = row.plan_kind !== "free" && row.plan_expires_at !== null && row.plan_expires_at < Date.now();
  return {
    userId,
    plan: {
      kind: expired ? "free" : row.plan_kind,
      creditsLeft: row.credits,
      expiresAt: !expired && row.plan_expires_at ? new Date(row.plan_expires_at).toISOString() : null,
      family: row.family === 1,
    },
    freeLetterUsed: row.free_letter_used === 1,
  };
}

export async function ensureUser(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)").bind(userId, Date.now()).run();
}

/** Creates a user row and returns the Set-Cookie header value. */
export async function createSession(fixedId?: string): Promise<{ userId: string; cookie: string }> {
  const env = getEnv();
  const userId = fixedId ?? randomId("u", 15);
  await ensureUser(env, userId);
  return { userId, cookie: cookieHeader(env, `${userId}.${await sign(env, userId)}`) };
}

/** Throws ApiError(401) without a valid signed cookie. */
export async function requireUser(req: Request): Promise<{ userId: string; plan: Plan }> {
  const state = await requireUserState(req);
  return { userId: state.userId, plan: state.plan };
}

export async function requireUserState(req: Request): Promise<UserState> {
  const env = getEnv();
  const userId = await userIdFromRequest(req, env);
  if (!userId) throw new ApiError(401, "No active session", "no_session");
  // A valid cookie whose row was lost (for example a database reset) is recreated.
  const state = (await loadUserState(env, userId)) ?? (await ensureUser(env, userId), await loadUserState(env, userId));
  if (!state) throw new ApiError(500, "Could not load your account", "internal");
  return state;
}
