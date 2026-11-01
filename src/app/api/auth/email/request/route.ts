import { limitAuth } from "@/lib/server/authguard";
import { checkEmailOrigin, emailRequestSchema, requestEmailCode } from "@/lib/server/email-auth";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    checkEmailOrigin(req, env);
    await limitAuth(env, req, "email_request", 10);
    const raw = await req.text();
    if (raw.length > 2048) throw new ApiError(413, "Request is too large", "too_large");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ApiError(400, "Request body must be JSON", "invalid_json"); }
    const result = await requestEmailCode(env, req, emailRequestSchema.parse(body));
    return Response.json(result.body, { headers: { "set-cookie": result.cookie, "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
