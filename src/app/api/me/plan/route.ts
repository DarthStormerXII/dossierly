import { z } from "zod";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";
import { markPlanChosen, mePayload } from "@/lib/server/me";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ choice: z.literal("free") });

/** The one-time tier choice. Choosing Plus happens by creating a checkout, which also marks the plan chosen. */
export async function POST(req: Request) {
  try {
    const state = await requireUserState(req);
    await readJson(req, body);
    await markPlanChosen(getEnv(), state.accountId);
    return Response.json(mePayload({ ...state, planChosen: true }), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
