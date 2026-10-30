import { cookies } from "next/headers";
import { getEnv } from "./env";
import { accountFromCookie } from "./session";

/**
 * Server-component guard: the signed-in account behind the session cookie, or null.
 * Legacy anonymous cookies and the shared sample user are not accounts.
 * Callers redirect to /signin on null and to the plan step while `planChosen` is false.
 */
export async function currentAccount(): Promise<{ accountId: string; planChosen: boolean } | null> {
  const jar = await cookies();
  const all = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const account = await accountFromCookie(all, getEnv());
  return account ? { accountId: account.accountId, planChosen: account.planChosen } : null;
}
