import { NextResponse } from "next/server";
import { z } from "zod";
import { mergedChanges } from "@/lib/hub/pipeline";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const Query = z.object({ country: z.literal("pl").default("pl") });

/** Public: detected changes on official Polish immigration pages, newest first. */
export async function GET(request: Request) {
  try {
    const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!q.success) return jsonError(400, "Only country=pl is supported", "invalid_request");
    return NextResponse.json({ country: q.data.country, changes: await mergedChanges(getEnv(), 30) });
  } catch (e) {
    return errorResponse(e);
  }
}
