import { errorResponse } from "@/lib/server/http";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const s = await requireUserState(req);
    return Response.json({ userId: s.userId, plan: s.plan, freeLetterUsed: s.freeLetterUsed }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
