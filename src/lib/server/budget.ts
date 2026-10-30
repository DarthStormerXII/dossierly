import type { Env } from "./env";
import { dayKey } from "./util";

export type BudgetKind = "tf_usd" | "tavily_credits";
const MICRO = 1_000_000;
const GLOBAL_CAPS: Record<BudgetKind, number> = { tf_usd: 2, tavily_credits: 10 };
const USER_CAPS: Partial<Record<BudgetKind, number>> = { tavily_credits: 1 };

async function spend(env: Env, scope: string, kind: BudgetKind, micro: number, capMicro: number): Promise<boolean> {
  const day = dayKey();
  for (let i = 0; i < 2; i++) {
    const upd = await env.DB.prepare(
      "UPDATE budgets SET spent_micro = spent_micro + ? WHERE day = ? AND scope = ? AND kind = ? AND spent_micro + ? <= ?",
    ).bind(micro, day, scope, kind, micro, capMicro).run();
    if ((upd.meta?.changes ?? 0) > 0) return true;
    const exists = await env.DB.prepare("SELECT 1 AS x FROM budgets WHERE day = ? AND scope = ? AND kind = ?").bind(day, scope, kind).first();
    if (exists) return false;
    const ins = await env.DB.prepare(
      "INSERT OR IGNORE INTO budgets (day, scope, kind, spent_micro) SELECT ?, ?, ?, ? WHERE ? <= ?",
    ).bind(day, scope, kind, micro, micro, capMicro).run();
    if ((ins.meta?.changes ?? 0) > 0) return true;
    if (micro > capMicro) return false;
  }
  return false;
}

/** Atomically reserves `amount` against today's caps; false when it would exceed one. */
export async function checkAndSpend(
  env: Env,
  kind: BudgetKind,
  amount: number,
  opts?: { userId?: string },
): Promise<boolean> {
  if (!(amount >= 0)) return false;
  const micro = Math.round(amount * MICRO);
  const userCap = USER_CAPS[kind];
  const userScope = opts?.userId && userCap !== undefined ? `user:${opts.userId}` : null;
  if (userScope && !(await spend(env, userScope, kind, micro, Math.round(userCap! * MICRO)))) return false;
  if (await spend(env, "global", kind, micro, Math.round(GLOBAL_CAPS[kind] * MICRO))) return true;
  if (userScope) {
    await env.DB.prepare("UPDATE budgets SET spent_micro = spent_micro - ? WHERE day = ? AND scope = ? AND kind = ?")
      .bind(micro, dayKey(), userScope, kind).run();
  }
  return false;
}

export async function getBudgets(env: Env) {
  const { results } = await env.DB.prepare("SELECT kind, spent_micro FROM budgets WHERE day = ? AND scope = 'global'")
    .bind(dayKey()).all<{ kind: BudgetKind; spent_micro: number }>();
  const spent = (k: BudgetKind) => (results.find((r) => r.kind === k)?.spent_micro ?? 0) / MICRO;
  return {
    day: dayKey(),
    tf_usd: { spent: spent("tf_usd"), cap: GLOBAL_CAPS.tf_usd },
    tavily_credits: { spent: spent("tavily_credits"), cap: GLOBAL_CAPS.tavily_credits },
  };
}
