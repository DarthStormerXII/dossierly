import { z } from "zod";
import { ApiError } from "../http";
import { broker } from "./broker";
import { brokerUser, toolkit, type AccountRow, type ConnectionsEnv } from "./types";

/** Delete only verified application-owned broker rows. Failed cleanup retains an opaque durable pointer for retry. */
export async function retirePrevious(env: ConnectionsEnv, accountId: string): Promise<boolean> {
  const { results } = await env.DB.prepare("SELECT account_id,broker_id,provider,auth_config_id FROM connection_retirements WHERE account_id=? ORDER BY created_at LIMIT 4").bind(accountId)
    .all<Pick<AccountRow, "account_id" | "broker_id" | "provider" | "auth_config_id">>();
  for (const row of results) {
    const referenced = await env.DB.prepare("SELECT broker_id FROM connection_accounts WHERE account_id=? AND broker_id=? LIMIT 1").bind(accountId, row.broker_id).first();
    if (referenced) continue;
    try {
      const remote = z.object({ id: z.string(), user_id: z.string(), toolkit: z.object({ slug: z.string() }), auth_config: z.object({ id: z.string() }) })
        .parse(await broker(env, `connected_accounts/${encodeURIComponent(row.broker_id)}`));
      if (remote.id !== row.broker_id || remote.user_id !== brokerUser(accountId) || remote.toolkit.slug !== toolkit(row.provider) || remote.auth_config.id !== row.auth_config_id) continue;
      await broker(env, `connected_accounts/${encodeURIComponent(row.broker_id)}`, undefined, "DELETE");
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "provider_connection_missing") continue;
    }
    await env.DB.prepare("DELETE FROM connection_retirements WHERE account_id=? AND broker_id=?").bind(accountId, row.broker_id).run();
  }
  return Boolean(await env.DB.prepare("SELECT broker_id FROM connection_retirements WHERE account_id=? LIMIT 1").bind(accountId).first());
}
