import { describe, expect, it, vi, afterEach } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import { saveRow, rowFor } from "@/lib/server/connections/store";
import { retirePrevious } from "@/lib/server/connections/retire";
import type { AccountRow, ConnectionsEnv } from "@/lib/server/connections/types";

const row = (broker_id: string, category: "mail" | "calendar" = "mail"): AccountRow => ({ account_id: "u_owned", category, provider: "outlook", broker_id, auth_config_id: "ac_owned", label: "Owned account", scopes: "[]", connected_at: 1 });
const setup = () => Object.assign(freshLocalEnv(), { COMPOSIO_API_KEY: "test", COMPOSIO_PROJECT_ID: "pr_owned" }) as ConnectionsEnv;
afterEach(() => vi.unstubAllGlobals());
describe("durable retirement after verified replacement", () => {
  it("atomically records replaced connections and retries provider failure without losing either pointer", async () => {
    const env = setup(); await saveRow(env, row("ca_old")); await saveRow(env, row("ca_new"));
    expect((await rowFor(env, "u_owned", "mail"))?.broker_id).toBe("ca_new");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await retirePrevious(env, "u_owned")).toBe(true);
    expect(await env.DB.prepare("SELECT broker_id FROM connection_retirements").first()).toEqual({ broker_id: "ca_old" });
    const deleted: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") { deleted.push(url); return Response.json({}); }
      return Response.json({ id: "ca_old", user_id: "dossierly:u_owned", toolkit: { slug: "outlook" }, auth_config: { id: "ac_owned" } });
    }));
    expect(await retirePrevious(env, "u_owned")).toBe(false); expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain("ca_old"); expect((await rowFor(env, "u_owned", "mail"))?.broker_id).toBe("ca_new");
  });
  it("never retires a shared category reference or a foreign provider account", async () => {
    const env = setup(); await saveRow(env, row("ca_shared")); await saveRow(env, row("ca_shared", "calendar")); await saveRow(env, row("ca_new"));
    expect(await env.DB.prepare("SELECT * FROM connection_retirements").first()).toBeNull();
    await saveRow(env, row("ca_other", "calendar"));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "ca_shared", user_id: "dossierly:foreign", toolkit: { slug: "outlook" }, auth_config: { id: "ac_owned" } })));
    expect(await retirePrevious(env, "u_owned")).toBe(true);
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
  it("serializes replacements so concurrent verified callbacks retain every retired connection", async () => {
    const env = setup(); await saveRow(env, row("ca_start"));
    await Promise.all([saveRow(env, row("ca_a")), saveRow(env, row("ca_b"))]);
    const { results } = await env.DB.prepare("SELECT broker_id FROM connection_retirements ORDER BY broker_id").all<{ broker_id: string }>();
    expect(results.map((r) => r.broker_id)).toEqual(["ca_a", "ca_start"]);
  });
});
