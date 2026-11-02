import { z } from "zod";
import type { ConnectionsEnv } from "./types";

const canonical = (email: string) => {
  const [local, domain] = email.trim().toLowerCase().split("@");
  return domain === "gmail.com" || domain === "googlemail.com" ? `${local.split("+")[0].replaceAll(".", "")}@gmail.com` : `${local}@${domain}`;
};
/** A Google Testing client is usable only by verified Dossierly accounts belonging to its approved testers. */
export async function gmailTestingAccess(env: ConnectionsEnv, accountId: string) {
  if (!env.COMPOSIO_GMAIL_TEST_USERS?.trim()) return { restricted: false, allowed: true };
  const configured = z.array(z.email()).min(1).max(100).safeParse(env.COMPOSIO_GMAIL_TEST_USERS.split(/[\s,]+/).filter(Boolean));
  if (!configured.success) return { restricted: true, allowed: false };
  const identity = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id=? AND verified_at>0").bind(accountId).first<{ email: string }>();
  return { restricted: true, allowed: Boolean(identity && configured.data.map(canonical).includes(canonical(identity.email))) };
}
