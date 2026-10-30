import type { Env } from "./env";
import { FREE_LETTERS } from "./session";

/**
 * Atomically spends one letter read for the account. Plus (case_pass) and judge plans are unlimited;
 * free accounts get FREE_LETTERS, then any credits an earlier buyer still holds.
 */
export async function spendLetter(env: Env, accountId: string, planKind: string): Promise<boolean> {
  if (planKind === "case_pass" || planKind === "judge") {
    await env.DB.prepare("UPDATE users SET letters_used = letters_used + 1 WHERE id = ?").bind(accountId).run();
    return true;
  }
  const free = await env.DB.prepare("UPDATE users SET letters_used = letters_used + 1 WHERE id = ? AND letters_used < ?")
    .bind(accountId, FREE_LETTERS).run();
  if ((free.meta?.changes ?? 0) > 0) return true;
  const paid = await env.DB.prepare("UPDATE users SET credits = credits - 1, letters_used = letters_used + 1 WHERE id = ? AND credits > 0")
    .bind(accountId).run();
  return (paid.meta?.changes ?? 0) > 0;
}
