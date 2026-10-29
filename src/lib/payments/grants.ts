import { z } from "zod";
import type { Env } from "@/lib/server/env";
import { isProduct, productFromId, type Product } from "./products";

const CASE_PASS_MS = 548 * 24 * 60 * 60 * 1000; // 18 months

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    payment_id: z.string().optional(),
    total_amount: z.number().optional(),
    currency: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    product_cart: z.array(z.object({ product_id: z.string() })).nullish(),
  }).passthrough(),
});

export type GrantOutcome = "granted" | "duplicate" | "ignored";

/** Applies one verified webhook event idempotently (payments.webhook_id and payment_id are unique). */
export async function applyWebhookEvent(env: Env, webhookId: string, body: unknown): Promise<GrantOutcome> {
  const ev = eventSchema.parse(body);
  const meta = ev.data.metadata ?? {};
  const userId = typeof meta.userId === "string" ? meta.userId : null;
  const fromMeta = isProduct(meta.product) ? meta.product : null;
  const fromCart = ev.data.product_cart?.map((i) => productFromId(env, i.product_id)).find(Boolean) ?? null;
  const product: Product | null = fromMeta ?? fromCart;
  const now = Date.now();
  const grants = ev.type === "payment.succeeded" && !!userId && !!product;

  const record = env.DB.prepare(
    "INSERT INTO payments (webhook_id, event_type, payment_id, user_id, product, amount, currency, granted, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).bind(webhookId, ev.type, ev.data.payment_id ?? null, userId, product, ev.data.total_amount ?? null, ev.data.currency ?? null, grants ? 1 : 0, now);

  const statements = [record];
  if (grants) {
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)").bind(userId, now));
    statements.push(grantStatement(env, userId!, product!, now));
  }
  try {
    await env.DB.batch(statements);
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String((e as Error)?.message))) return "duplicate";
    throw e;
  }
  return grants ? "granted" : "ignored";
}

function grantStatement(env: Env, userId: string, product: Product, now: number) {
  switch (product) {
    case "case_pass":
      return env.DB.prepare(
        "UPDATE users SET plan_kind = 'case_pass', plan_expires_at = MAX(COALESCE(plan_expires_at, 0), ?) WHERE id = ?",
      ).bind(now + CASE_PASS_MS, userId);
    case "credits_10":
      return env.DB.prepare("UPDATE users SET credits = credits + 10 WHERE id = ?").bind(userId);
    case "credits_25":
      return env.DB.prepare("UPDATE users SET credits = credits + 25 WHERE id = ?").bind(userId);
    case "family":
      return env.DB.prepare("UPDATE users SET family = 1 WHERE id = ?").bind(userId);
  }
}
