import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { ensureUser, loadUserState } from "@/lib/server/session";
import { sha256Hex, timingSafeEqual } from "@/lib/server/util";

export const REDEEM_CAP = 200;
export const JUDGE_EXPIRES_MS = Date.UTC(2026, 11, 16, 23, 59, 59);

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");

export async function redeemJudgeCode(env: Env, userId: string, code: string, now = Date.now()) {
  if (!env.JUDGE_CODE || now > JUDGE_EXPIRES_MS || !timingSafeEqual(norm(code), norm(env.JUDGE_CODE))) {
    throw new ApiError(400, "That code is not valid", "invalid_code");
  }
  await ensureUser(env, userId);
  let inserted: number;
  try {
    const r = await env.DB.prepare(
      "INSERT INTO redemptions (user_id, code_hash, redeemed_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM redemptions) < ?",
    ).bind(userId, await sha256Hex(norm(code)), now, REDEEM_CAP).run();
    inserted = r.meta?.changes ?? 0;
  } catch {
    throw new ApiError(409, "This code has already been used on your account", "already_redeemed");
  }
  if (inserted === 0) throw new ApiError(410, "All access codes have been used", "code_exhausted");
  await env.DB.prepare("UPDATE users SET plan_kind = 'judge', plan_expires_at = ? WHERE id = ?").bind(JUDGE_EXPIRES_MS, userId).run();
  const state = await loadUserState(env, userId);
  return state!.plan;
}
