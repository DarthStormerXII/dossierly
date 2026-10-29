import { acceptJobResult, requireJobToken } from "@/lib/agent/job";
import { JobResultSchema } from "@/lib/agent/schemas";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Ingest for the Nebius Serverless Job audit. Auth: x-job-token (HMAC of the bridge secret). */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    await requireJobToken(req, env);
    return Response.json(await acceptJobResult(env, await readJson(req, JobResultSchema)));
  } catch (e) {
    return errorResponse(e);
  }
}
