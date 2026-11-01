import { jsonError } from "./http";

/** Keep legacy data; new authentication is email-code-only. */
export function retiredAuth(_req?: Request) {
  void _req;
  return jsonError(410, "Sign in with an email code instead.", "email_signin_required", { "cache-control": "no-store" });
}
