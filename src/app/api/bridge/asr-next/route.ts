import { requireBridgeSecret } from "@/lib/agent/auth";
import { claimAsrJob } from "@/lib/server/asr";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const env = getEnv();
    requireBridgeSecret(req, env);
    const job = await claimAsrJob(env);
    if (!job) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
