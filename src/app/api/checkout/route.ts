import { z } from "zod";
import { createCheckout } from "@/lib/payments/dodo";
import { PRODUCTS } from "@/lib/payments/products";
import { getEnv } from "@/lib/server/env";
import { errorResponse, jsonError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const body = z.object({ product: z.enum(PRODUCTS), code: z.string().trim().min(1).max(40).optional() });

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const { userId } = await requireUser(req);
    const rl = await rateLimit(env, userId, "checkout", 10, 60);
    if (!rl.ok) return jsonError(429, "Too many attempts. Try again in a minute.", "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    const { product, code } = await readJson(req, body);
    const origin = env.APP_URL || new URL(req.url).origin;
    const checkoutUrl = await createCheckout(env, { userId, product, code, returnUrl: `${origin}/app?paid=1` });
    return Response.json({ checkoutUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
