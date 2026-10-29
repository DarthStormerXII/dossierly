import { requireBridgeSecret } from "@/lib/agent/auth";
import { claimNextTask } from "@/lib/agent/queue";
import { getEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const env = getEnv();
    requireBridgeSecret(req, env);
    const sandboxes = Number(req.headers.get("x-bridge-sandboxes"));
    await Promise.all([
      env.CACHE.put("bridge:lastSeen", String(Date.now())),
      Number.isInteger(sandboxes) && sandboxes >= 0 ? env.CACHE.put("bridge:sandboxes", String(sandboxes)) : Promise.resolve(),
    ]);
    const row = await claimNextTask(env);
    if (!row) return Response.json({ task: null }, { headers: { "cache-control": "no-store" } });
    return Response.json(
      { task: { id: row.id, userId: row.user_id, kind: row.kind, createdAt: row.created_at, input: JSON.parse(row.input ?? "{}") } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
