import type { Env } from "./env";
import { ApiError } from "./http";
import { randomId } from "./util";

/** Preserve existing signed-in legacy accounts; never merge two accounts by unverified input. */
export async function emailAccount(env: Env, email: string, attachUserId: string | null, now: number): Promise<string> {
  const existing = await env.DB.prepare("SELECT user_id FROM email_identities WHERE email = ?")
    .bind(email).first<{ user_id: string }>();
  if (existing) return existing.user_id;

  const candidate = attachUserId ?? randomId("u", 20);
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at, account_kind) VALUES (?, ?, 'device')").bind(candidate, now),
    env.DB.prepare("INSERT OR IGNORE INTO email_identities (email, user_id, verified_at) VALUES (?, ?, ?)").bind(email, candidate, now),
    // Concurrent verification of the same address must not leave an extra account behind.
    env.DB.prepare("DELETE FROM users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM email_identities WHERE user_id = ?) AND ? = 1")
      .bind(candidate, candidate, attachUserId ? 0 : 1),
  ]);
  const identity = await env.DB.prepare("SELECT user_id FROM email_identities WHERE email = ?")
    .bind(email).first<{ user_id: string }>();
  if (!identity) throw new ApiError(409, "This account already has an email. Sign in with that address.", "email_conflict");
  return identity.user_id;
}
