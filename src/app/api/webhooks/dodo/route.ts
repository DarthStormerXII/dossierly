import { applyWebhookEvent } from "@/lib/payments/grants";
import { verifyWebhook } from "@/lib/payments/webhook";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const raw = await req.text();
    const id = req.headers.get("webhook-id");
    const verdict = await verifyWebhook(raw, {
      id,
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    }, env.DODO_WEBHOOK_KEY);
    if (!verdict.ok) {
      return jsonError(verdict.reason === "no_key" ? 503 : 401, "Webhook rejected", `webhook_${verdict.reason}`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return jsonError(400, "Body must be JSON", "invalid_json");
    }
    const outcome = await applyWebhookEvent(env, id!, payload);
    return Response.json({ ok: true, outcome });
  } catch (e) {
    return errorResponse(e);
  }
}
