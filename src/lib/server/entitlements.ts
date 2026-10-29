import type { Env } from "./env";

/** First letter is free; afterwards a case pass/judge plan or one credit pays. Atomic. */
export async function spendLetter(env: Env, userId: string, planKind: string): Promise<boolean> {
  const free = await env.DB.prepare("UPDATE users SET free_letter_used = 1 WHERE id = ? AND free_letter_used = 0").bind(userId).run();
  if ((free.meta?.changes ?? 0) > 0) return true;
  if (planKind === "case_pass" || planKind === "judge") return true;
  const paid = await env.DB.prepare("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0").bind(userId).run();
  return (paid.meta?.changes ?? 0) > 0;
}
