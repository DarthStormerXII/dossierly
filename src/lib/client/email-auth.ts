import { z } from "zod";
import { call, type ApiFailure, type ApiResult } from "./api";

export const emailSchema = z.string().trim().max(254).email();
const challengeSchema = z.object({
  challengeId: z.string().min(1),
  expiresIn: z.number().int().positive().max(3600),
  resendAfter: z.number().int().nonnegative().max(3600),
});
export type EmailChallenge = z.infer<typeof challengeSchema>;

export async function requestEmailCode(email: string): Promise<ApiResult<EmailChallenge>> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, status: 400, code: "invalid_email", error: "Enter a valid email address." };
  const r = await call<unknown>("/api/auth/email/request", {
    method: "POST", body: JSON.stringify({ email: parsed.data }),
  });
  if (!r.ok) return r;
  const challenge = challengeSchema.safeParse(r.data);
  return challenge.success ? { ok: true, data: challenge.data }
    : { ok: false, status: 502, code: "email_unavailable", error: "Email is temporarily unavailable." };
}

export function emailError(f: ApiFailure): string {
  if (f.status === 0) return "You seem to be offline. Check your connection and try again.";
  if (f.status === 429) return "Too many requests. Wait a minute before trying again.";
  switch (f.code) {
    case "invalid_email": return "Enter a valid email address.";
    case "invalid_code": return "That code didn’t match. Check the six digits in your latest email and try again.";
    case "expired_code": return "That code has expired. Request a new code to continue.";
    case "too_many_attempts": return "Too many attempts with this code. Request a new code to try again.";
    case "rate_limited": return "Too many requests. Wait a minute before trying again.";
    default: return "We can’t complete email sign-in right now. Please try again in a few minutes.";
  }
}
