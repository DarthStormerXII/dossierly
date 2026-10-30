import { z } from "zod";
import { limitAuth } from "@/lib/server/authguard";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { registerOptions } from "@/lib/server/passkey";

export const dynamic = "force-dynamic";

const body = z.object({ label: z.string().trim().max(40).optional() }).default({});

export async function POST(req: Request) {
  try {
    const env = getEnv();
    await limitAuth(env, req, "auth_reg");
    const raw = await req.text();
    const { label } = body.parse(raw ? JSON.parse(raw) : {});
    return Response.json(await registerOptions(env, req, label), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
