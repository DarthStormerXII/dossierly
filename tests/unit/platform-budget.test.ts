import { describe, expect, it } from "vitest";
import { GLOBAL_CAPS, checkAndSpend, getBudgets } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";

const TF = GLOBAL_CAPS.tf_usd;
const TAVILY = GLOBAL_CAPS.tavily_credits;

describe("budget caps", () => {
  it(`caps Token Factory spend at $${TF} per day`, async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "tf_usd", TF * 0.6)).toBe(true);
    expect(await checkAndSpend(env, "tf_usd", TF * 0.4)).toBe(true);
    expect(await checkAndSpend(env, "tf_usd", 0.000001)).toBe(false);
    expect((await getBudgets(env)).tf_usd.spent).toBeCloseTo(TF, 6);
  });

  it("rejects a single spend larger than the cap", async () => {
    expect(await checkAndSpend(freshLocalEnv(), "tf_usd", TF + 0.01)).toBe(false);
  });

  it(`allows ${TAVILY} Tavily credits globally and 1 per user`, async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "u1" })).toBe(true);
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "u1" })).toBe(false);
    for (let i = 2; i <= TAVILY; i++) expect(await checkAndSpend(env, "tavily_credits", 1, { userId: `u${i}` })).toBe(true);
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "over" })).toBe(false);
    expect((await getBudgets(env)).tavily_credits.spent).toBe(TAVILY);
  });

  it("refunds the per-user reservation when the global cap blocks", async () => {
    const env = freshLocalEnv();
    for (let i = 0; i < TAVILY; i++) await checkAndSpend(env, "tavily_credits", 1, { userId: `f${i}` });
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "late" })).toBe(false);
    const row = await env.DB.prepare("SELECT spent_micro FROM budgets WHERE scope = 'user:late'").first<{ spent_micro: number }>();
    expect(row?.spent_micro).toBe(0);
  });

  it("is safe under concurrency", async () => {
    const env = freshLocalEnv();
    const slice = TF / 5;
    const results = await Promise.all(Array.from({ length: 10 }, () => checkAndSpend(env, "tf_usd", slice)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
