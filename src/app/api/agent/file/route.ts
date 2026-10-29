import { enqueueAgentTask } from "@/lib/agent/queue";
import { FileRequestSchema } from "@/lib/agent/schemas";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await requireUser(req);
    const env = getEnv();
    const rl = await rateLimit(env, userId, "agent_file", 12, 60);
    if (!rl.ok) return jsonError(429, "Too many requests. Try again shortly.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const body = await readJson(req, FileRequestSchema);
    const { taskId } = await enqueueAgentTask(env, { userId, kind: "file", input: body });
    return Response.json({ taskId });
  } catch (e) {
    return errorResponse(e);
  }
}
