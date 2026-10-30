import { limitAuth } from "@/lib/server/authguard";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { loginOptions } from "@/lib/server/passkey";

export const dynamic = "force-dynamic";

/** Discoverable credentials: the browser offers whichever Dossierly passkey the person has. */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    await limitAuth(env, req, "auth_login");
    return Response.json(await loginOptions(env, req), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
