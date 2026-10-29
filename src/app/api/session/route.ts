import { z } from "zod";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { createSession, loadUserState, userIdFromRequest } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** The SAMPLE case is one shared demo user whose private agent is the pinned `companion-arjun` sandbox. */
const SAMPLE_USER_ID = "sample-arjun";

const BodySchema = z.object({ sample: z.boolean().optional() }).default({});

/**
 * Idempotent: reuses a valid cookie, otherwise creates a user and sets the session cookie.
 * `{ sample: true }` switches to the shared SAMPLE user; `{ sample: false }` leaves it for a fresh own user.
 */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    const raw = await req.text();
    const parsed = BodySchema.safeParse(raw ? JSON.parse(raw) : {});
    if (!parsed.success) return Response.json({ error: "Invalid request", code: "bad_request" }, { status: 400 });
    const wantSample = parsed.data.sample;

    const existing = await userIdFromRequest(req, env);
    const isSample = existing === SAMPLE_USER_ID;
    const keep = existing && (wantSample === undefined || wantSample === isSample);
    const state = keep ? await loadUserState(env, existing) : null;
    if (state) return Response.json({ userId: state.userId, plan: state.plan, freeLetterUsed: state.freeLetterUsed });

    const { userId, cookie } = await createSession(wantSample ? SAMPLE_USER_ID : undefined);
    const fresh = await loadUserState(env, userId);
    return Response.json(
      { userId, plan: fresh!.plan, freeLetterUsed: fresh!.freeLetterUsed },
      { headers: { "set-cookie": cookie, "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
