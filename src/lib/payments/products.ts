import type { Env } from "@/lib/server/env";

export const PRODUCTS = ["case_pass", "credits_10", "credits_25", "family"] as const;
export type Product = (typeof PRODUCTS)[number];

/**
 * Live Dodo products (USD, one-time, brand Dossierly):
 *  case_pass = "Dossierly Plus" USD 39.00, one residence case for 18 months: pdt_0Nqr5MdtcQ1vyQXIRVKZi
 *  family    = "Dossierly Family add-on" USD 15.00: pdt_0Nqr5MjRO1c3BU4tlKY88
 * The credits products are legacy: no longer sold, still granted if an old webhook arrives.
 */
export function productId(env: Env, product: Product): string {
  const map: Record<Product, string> = {
    case_pass: env.DODO_PRODUCT_CASE_PASS,
    credits_10: env.DODO_PRODUCT_CREDITS_10,
    credits_25: env.DODO_PRODUCT_CREDITS_25,
    family: env.DODO_PRODUCT_FAMILY,
  };
  return map[product];
}

export function productFromId(env: Env, id: string): Product | null {
  return PRODUCTS.find((p) => productId(env, p) && productId(env, p) === id) ?? null;
}

export const isProduct = (v: unknown): v is Product => PRODUCTS.includes(v as Product);
