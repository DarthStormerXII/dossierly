import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { proxyModels } from "@/lib/server/tfproxy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ sandbox: string; sig: string }> }) {
  try {
    const { sandbox, sig } = await ctx.params;
    return await proxyModels(getEnv(), sandbox, sig);
  } catch (e) {
    return errorResponse(e);
  }
}
