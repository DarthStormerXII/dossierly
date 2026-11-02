import { enqueueAgentTask } from "@/lib/agent/queue";
import { AskRequestSchema } from "@/lib/agent/schemas";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";
import { boundedJson, sameOrigin } from "@/lib/server/request";
import { buildHubContext } from "@/lib/hub/pipeline";
import { maskerFor } from "@/lib/mask";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    sameOrigin(req, env);
    const { accountId: userId } = await requireUser(req);
    const rl = await rateLimit(env, userId, "agent_ask", 12, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const body = await boundedJson(req, AskRequestSchema, 100_000);
    const masker = maskerFor({ name: body.case.profile.name, caseNumber: body.case.caseNumber, addresses: body.case.profile.addresses });
    const masked = masker.maskDeep(body);
    const hub = await buildHubContext(env, { userId, appointment: { office: masked.case.office, purpose: masked.question }, language: body.language });
    const { taskId } = await enqueueAgentTask(env, { userId, kind: "ask", input: {
      ...masked, passages: hub.passages.slice(0, 12).map(({ url, title, text }) => ({ url, title, text: text.slice(0, 5900) })),
    } });
    return Response.json({ taskId });
  } catch (e) {
    return errorResponse(e);
  }
}
