import { getAsrJob } from "@/lib/server/asr";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireUserState(req);
    const { id } = await ctx.params;
    return Response.json(await getAsrJob(getEnv(), userId, id), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
