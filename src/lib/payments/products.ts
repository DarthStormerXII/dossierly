import type { Env } from "@/lib/server/env";

export const PRODUCTS = ["case_pass", "credits_10", "credits_25", "family"] as const;
export type Product = (typeof PRODUCTS)[number];

/** Case Pass: 149 PLN / 35 EUR / 39 USD one-time. Credits 10 = 59 PLN, 25 = 129 PLN. Family add-on = 59 PLN. */
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
