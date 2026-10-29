import { z } from "zod";
import { redeemJudgeCode } from "@/lib/payments/redeem";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().min(1).max(64) });

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const { userId } = await requireUser(req);
    const rl = await rateLimit(env, userId, "redeem", 5, 60);
    if (!rl.ok) return jsonError(429, "Too many attempts. Try again in a minute.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const { code } = await readJson(req, body);
    return Response.json({ plan: await redeemJudgeCode(env, userId, code) });
  } catch (e) {
    return errorResponse(e);
  }
}
