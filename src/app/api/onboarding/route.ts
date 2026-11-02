import { OnboardingRequestSchema } from "@/lib/onboarding/schema";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { getOnboarding, updateOnboarding } from "@/lib/server/onboarding";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { requireUserState } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { ApiError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const { accountId } = await requireUserState(req);
    return Response.json(await getOnboarding(getEnv(), accountId), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const env = getEnv(); sameOrigin(req, env);
    const { accountId } = await requireUserState(req);
    if (!(await rateLimit(env, accountId, "onboarding", 60, 60)).ok) throw new ApiError(429, "Wait a moment before saving again", "rate_limited");
    const body = await boundedJson(req, OnboardingRequestSchema);
    return Response.json(await updateOnboarding(env, accountId, body), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
