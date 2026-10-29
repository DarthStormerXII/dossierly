import { requireBridgeSecret } from "@/lib/agent/auth";
import { BridgeResultSchema } from "@/lib/agent/schemas";
import { acceptBridgeResult } from "@/lib/agent/service";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    requireBridgeSecret(req, env);
    const body = await readJson(req, BridgeResultSchema);
    return Response.json(await acceptBridgeResult(env, body));
  } catch (e) {
    return errorResponse(e);
  }
}
