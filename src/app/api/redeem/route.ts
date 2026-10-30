import { z } from "zod";
import { redeemJudgeCode } from "@/lib/payments/redeem";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { markPlanChosen } from "@/lib/server/me";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ code: z.string().min(1).max(64) });

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const { accountId } = await requireUser(req);
    const rl = await rateLimit(env, accountId, "redeem", 5, 60);
    if (!rl.ok) return jsonError(429, "Too many attempts. Try again in a minute.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const { code } = await readJson(req, body);
    const plan = await redeemJudgeCode(env, accountId, code);
    await markPlanChosen(env, accountId);
    return Response.json({ plan });
  } catch (e) {
    return errorResponse(e);
  }
}
