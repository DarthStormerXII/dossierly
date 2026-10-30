import { z } from "zod";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { mePayload, setActiveCase } from "@/lib/server/me";
import { requireUserState } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ sample: z.boolean().optional() });

/**
 * No longer creates users. With a valid account it switches the active case:
 * `{ sample: true }` joins the shared SAMPLE case, `{ sample: false }` returns to the account's own case.
 */
export async function POST(req: Request) {
  try {
    const state = await requireUserState(req);
    const raw = await req.text();
    let json: unknown = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new ApiError(400, "Request body must be JSON", "invalid_json");
    }
    const { sample } = body.parse(json);
    if (sample !== undefined) {
      const activeCase = sample ? "sample" : "own";
      await setActiveCase(getEnv(), state.accountId, activeCase);
      state.activeCase = activeCase;
    }
    return Response.json(mePayload(state), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
