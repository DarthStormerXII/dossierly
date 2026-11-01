import { authResponse, limitAuth } from "@/lib/server/authguard";
import { checkEmailOrigin, emailVerifySchema, verifyEmailCode } from "@/lib/server/email-auth";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    checkEmailOrigin(req, env);
    await limitAuth(env, req, "email_verify", 30);
    const raw = await req.text();
    if (raw.length > 2048) throw new ApiError(413, "Request is too large", "too_large");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ApiError(400, "Request body must be JSON", "invalid_json"); }
    const result = await verifyEmailCode(env, req, emailVerifySchema.parse(body));
    const response = await authResponse(env, result.userId, result.cookie);
    response.headers.append("set-cookie", result.clearChallenge);
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
