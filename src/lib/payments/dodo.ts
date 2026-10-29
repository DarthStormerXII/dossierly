import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { productId, type Product } from "./products";

const BASE = { test_mode: "https://test.dodopayments.com", live_mode: "https://live.dodopayments.com" } as const;

/** Creates a hosted Dodo checkout session; metadata carries userId and product back to the webhook. */
export async function createCheckout(
  env: Env,
  args: { userId: string; product: Product; returnUrl: string; code?: string },
): Promise<string> {
  const id = productId(env, args.product);
  if (!env.DODO_PAYMENTS_API_KEY || !id) throw new ApiError(503, "Payments are not available yet", "payments_unavailable");
  let res: Response;
  try {
    res = await fetch(`${BASE[env.DODO_ENV]}/checkouts`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        product_cart: [{ product_id: id, quantity: 1 }],
        return_url: args.returnUrl,
        metadata: { userId: args.userId, product: args.product },
        ...(args.code ? { discount_code: args.code } : {}),
      }),
    });
  } catch {
    throw new ApiError(502, "The payment provider could not be reached", "payments_unavailable");
  }
  if (res.status === 422 || res.status === 404) {
    throw new ApiError(400, "That discount code is not valid for this purchase", "invalid_code");
  }
  if (!res.ok) throw new ApiError(502, "The payment provider rejected the request", "payments_unavailable");
  const data = (await res.json()) as { checkout_url?: string | null };
  if (!data.checkout_url) throw new ApiError(502, "The payment provider returned no checkout link", "payments_unavailable");
  return data.checkout_url;
}
