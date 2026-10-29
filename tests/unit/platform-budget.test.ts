import { describe, expect, it } from "vitest";
import { checkAndSpend, getBudgets } from "@/lib/server/budget";
import { freshLocalEnv } from "@/lib/server/local";

describe("budget caps", () => {
  it("caps Token Factory spend at $0.50 per day", async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "tf_usd", 0.3)).toBe(true);
    expect(await checkAndSpend(env, "tf_usd", 0.2)).toBe(true);
    expect(await checkAndSpend(env, "tf_usd", 0.000001)).toBe(false);
    expect((await getBudgets(env)).tf_usd.spent).toBeCloseTo(0.5, 6);
  });

  it("rejects a single spend larger than the cap", async () => {
    expect(await checkAndSpend(freshLocalEnv(), "tf_usd", 0.51)).toBe(false);
  });

  it("allows 5 Tavily credits globally and 1 per user", async () => {
    const env = freshLocalEnv();
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "u1" })).toBe(true);
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "u1" })).toBe(false);
    for (const u of ["u2", "u3", "u4", "u5"]) expect(await checkAndSpend(env, "tavily_credits", 1, { userId: u })).toBe(true);
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "u6" })).toBe(false);
    expect((await getBudgets(env)).tavily_credits.spent).toBe(5);
  });

  it("refunds the per-user reservation when the global cap blocks", async () => {
    const env = freshLocalEnv();
    for (let i = 0; i < 5; i++) await checkAndSpend(env, "tavily_credits", 1, { userId: `f${i}` });
    expect(await checkAndSpend(env, "tavily_credits", 1, { userId: "late" })).toBe(false);
    const row = await env.DB.prepare("SELECT spent_micro FROM budgets WHERE scope = 'user:late'").first<{ spent_micro: number }>();
    expect(row?.spent_micro).toBe(0);
  });

  it("is safe under concurrency", async () => {
    const env = freshLocalEnv();
    const results = await Promise.all(Array.from({ length: 10 }, () => checkAndSpend(env, "tf_usd", 0.1)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
