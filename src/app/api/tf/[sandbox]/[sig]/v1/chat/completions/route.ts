import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";
import { proxyChat, type WaitUntil } from "@/lib/server/tfproxy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** waitUntil on Workers, so a streamed call settles after the response ends; detached in `next dev` and tests. */
const waitUntil: WaitUntil = (p) => {
  const safe = p.catch(() => undefined);
  try {
    getCloudflareContext().ctx.waitUntil(safe);
  } catch {
    void safe;
  }
};

/** Metering proxy for the private-agent sandboxes: OpenAI-compatible, auth in the path. */
export async function POST(req: Request, ctx: { params: Promise<{ sandbox: string; sig: string }> }) {
  try {
    const { sandbox, sig } = await ctx.params;
    return await proxyChat(getEnv(), req, sandbox, sig, waitUntil);
  } catch (e) {
    return errorResponse(e);
  }
}
