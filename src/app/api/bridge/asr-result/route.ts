import { requireBridgeSecret } from "@/lib/agent/auth";
import { AsrResultSchema, finishAsrJob } from "@/lib/server/asr";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    requireBridgeSecret(req, env);
    await finishAsrJob(env, await readJson(req, AsrResultSchema));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
