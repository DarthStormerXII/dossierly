import { requireBridgeSecret } from "@/lib/agent/auth";
import { BridgeEgressSchema } from "@/lib/agent/schemas";
import { acceptEgress } from "@/lib/agent/service";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    requireBridgeSecret(req, env);
    const body = await readJson(req, BridgeEgressSchema);
    return Response.json(await acceptEgress(env, body));
  } catch (e) {
    return errorResponse(e);
  }
}
