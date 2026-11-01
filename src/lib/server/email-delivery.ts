import { z } from "zod";
import type { Env } from "./env";
import { ApiError } from "./http";

export type SendCode = (email: string, code: string, challengeId: string) => Promise<void>;

export function requireEmailDelivery(env: Env) {
  if (!env.RESEND_API_KEY || !z.email().safeParse(env.EMAIL_FROM).success) {
    throw new ApiError(503, "Email sign-in is temporarily unavailable. Please try again later.", "email_unavailable");
  }
}

/** Transactional sign-in codes only. Never logs recipient, code, or provider error bodies. */
export async function sendEmailCode(env: Env, email: string, code: string, challengeId: string): Promise<void> {
  requireEmailDelivery(env);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `dossierly-signin/${challengeId}`,
      },
      body: JSON.stringify({
        from: `Dossierly <${env.EMAIL_FROM}>`,
        to: [email],
        subject: "Your Dossierly sign-in code",
        text: `Your Dossierly sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once. Enter it only in the browser where you requested it.\n\nIf you did not request this code, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("delivery_failed");
    const result = z.object({ id: z.string().min(1) }).safeParse(await response.json());
    if (!result.success) throw new Error("delivery_failed");
  } catch {
    throw new ApiError(503, "We could not send your code. Please try again later.", "email_unavailable");
  }
}
