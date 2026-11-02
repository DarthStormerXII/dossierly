import { enqueueAgentTask } from "@/lib/agent/queue";
import { FileRequestSchema } from "@/lib/agent/schemas";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { maskerFor } from "@/lib/mask";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const { accountId: userId } = await requireUser(req);
    const rl = await rateLimit(env, userId, "agent_file", 12, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const body = await boundedJson(req, FileRequestSchema, 100_000);
    const masker = maskerFor({ name: body.case.profile.name, addresses: body.case.profile.addresses, caseNumber: body.case.caseNumber });
    const { taskId } = await enqueueAgentTask(env, { userId, kind: "file", input: masker.maskDeep(body) });
    return Response.json({ taskId });
  } catch (e) {
    return errorResponse(e);
  }
}
