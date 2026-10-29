import { getTask, taskView } from "@/lib/agent/queue";
import { advanceTask } from "@/lib/agent/service";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUser(req);
    const { id } = await ctx.params;
    const env = getEnv();
    const row = await getTask(env, id);
    // Same answer for "missing" and "someone else's": task ids never reveal other users.
    if (!row || row.user_id !== userId) throw new ApiError(404, "Task not found", "not_found");
    return Response.json(taskView(await advanceTask(env, row)), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
