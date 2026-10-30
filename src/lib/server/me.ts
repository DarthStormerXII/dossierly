import type { Env } from "./env";
import { FREE_LETTERS, type AccountKind, type ActiveCase, type Plan, type UserState } from "./session";

export type MePayload = {
  accountId: string;
  accountKind: AccountKind;
  activeCase: ActiveCase;
  plan: Plan;
  planChosen: boolean;
  lettersUsed: number;
  freeLetters: number;
};

export function mePayload(s: UserState): MePayload {
  return {
    accountId: s.accountId,
    accountKind: s.accountKind ?? "device",
    activeCase: s.activeCase,
    plan: s.plan,
    planChosen: s.planChosen,
    lettersUsed: s.lettersUsed,
    freeLetters: FREE_LETTERS,
  };
}

export async function setActiveCase(env: Env, accountId: string, active: ActiveCase): Promise<void> {
  await env.DB.prepare("UPDATE users SET active_case = ? WHERE id = ?").bind(active, accountId).run();
}

export async function markPlanChosen(env: Env, accountId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET plan_chosen = 1 WHERE id = ?").bind(accountId).run();
}
