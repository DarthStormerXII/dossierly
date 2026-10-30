import { z } from "zod";
import { authResponse, limitAuth } from "@/lib/server/authguard";
import { getEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/http";
import { registerVerify } from "@/lib/server/passkey";

export const dynamic = "force-dynamic";

const body = z.object({
  pendingId: z.string().min(8).max(64),
  response: z.object({ id: z.string().min(1).max(1024), rawId: z.string(), type: z.literal("public-key"), response: z.record(z.string(), z.unknown()) }).passthrough(),
});

export async function POST(req: Request) {
  try {
    const env = getEnv();
    await limitAuth(env, req, "auth_reg");
    const { pendingId, response } = await readJson(req, body);
    const { userId, cookie } = await registerVerify(env, req, pendingId, response as unknown as Parameters<typeof registerVerify>[3]);
    return await authResponse(env, userId, cookie);
  } catch (e) {
    return errorResponse(e);
  }
}
