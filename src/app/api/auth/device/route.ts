import { authResponse, limitAuth } from "@/lib/server/authguard";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { createAccountUser, sessionCookie } from "@/lib/server/session";
import { randomId } from "@/lib/server/util";

export const dynamic = "force-dynamic";

/** Fallback for browsers without passkeys: an account that lives on this device's cookie. */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    await limitAuth(env, req, "auth_device");
    const userId = randomId("u", 15);
    await createAccountUser(env, userId, "device");
    return await authResponse(env, userId, await sessionCookie(userId, env));
  } catch (e) {
    return errorResponse(e);
  }
}
