import { z } from "zod";
import { ApiError } from "../http";
import { brokerUser, toolkit, type AccountRow, type ConnectionsEnv, type Provider } from "./types";

export const unavailable = () => new ApiError(503, "This connection is not configured yet.", "connection_unavailable");
export const reconnect = () => new ApiError(409, "Reconnect this account to continue.", "connection_reconnect");
export async function broker(env: ConnectionsEnv, path: string, body?: unknown, method = body === undefined ? "GET" : "POST", limit = 1_000_000): Promise<unknown> {
  if (!env.COMPOSIO_API_KEY || !env.COMPOSIO_PROJECT_ID) throw unavailable();
  let res: Response;
  try { res = await fetch(`https://backend.composio.dev/api/v3.1/${path}`, { method,
    headers: { "x-api-key": env.COMPOSIO_API_KEY, "content-type": "application/json" },
    // Workers rejects redirect:"error" before sending. Manual mode keeps credentials on this exact origin.
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000), redirect: "manual" }); }
  catch { throw new ApiError(502, "The connection provider did not respond. Try again.", "provider_unavailable"); }
  if (!res.ok) {
    await res.body?.cancel();
    if (res.status === 404) throw new ApiError(404, "That connection is no longer available.", "provider_connection_missing");
    if ([401, 403].includes(res.status)) throw new ApiError(503, "The connection service needs attention.", "provider_configuration");
    throw new ApiError(res.status === 429 ? 429 : 502, "The connection provider is temporarily unavailable.", "provider_unavailable");
  }
  const reader = res.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let bytes = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new ApiError(413, "The provider response is too large.", "response_too_large"); } chunks.push(part.value); }
  const out = new Uint8Array(bytes); let i = 0; for (const c of chunks) { out.set(c, i); i += c.length; }
  try { return JSON.parse(new TextDecoder().decode(out)); } catch { throw new ApiError(502, "The provider returned an invalid response.", "provider_response"); }
}
export const remoteSchema = z.object({ id: z.string(), user_id: z.string(), status: z.string(),
  toolkit: z.object({ slug: z.string() }), auth_config: z.object({ id: z.string() }),
  state: z.object({ val: z.record(z.string(), z.unknown()).optional() }).optional() });
export async function verifyRemote(env: ConnectionsEnv, row: Pick<AccountRow, "account_id" | "broker_id" | "provider" | "auth_config_id">) {
  const parsed = remoteSchema.safeParse(await broker(env, `connected_accounts/${encodeURIComponent(row.broker_id)}`));
  if (!parsed.success || parsed.data.id !== row.broker_id || parsed.data.user_id !== brokerUser(row.account_id) ||
    parsed.data.auth_config.id !== row.auth_config_id || parsed.data.toolkit.slug !== toolkit(row.provider) || parsed.data.status !== "ACTIVE") throw reconnect();
  return parsed.data;
}
export async function verifyConfig(env: ConnectionsEnv, id: string, provider: Provider) {
  const schema = z.object({ id: z.string(), name: z.string(), status: z.string().optional(), toolkit: z.object({ slug: z.string() }) });
  const r = schema.safeParse(await broker(env, `auth_configs/${encodeURIComponent(id)}`));
  if (!r.success || r.data.id !== id || !r.data.name.toLowerCase().startsWith("dossierly-") || r.data.toolkit.slug !== toolkit(provider) || r.data.status === "DISABLED") throw unavailable();
}
export async function proxy(env: ConnectionsEnv, row: AccountRow, endpoint: string, method = "GET", body?: unknown, limit?: number) {
  // Endpoints are constructed only by this module's callers, never accepted from the browser.
  const r = z.object({ status: z.number(), data: z.unknown().optional() }).parse(await broker(env, "tools/execute/proxy", {
    connected_account_id: row.broker_id, user_id: brokerUser(row.account_id), endpoint, method, ...(body ? { body } : {}),
  }, "POST", limit));
  if ([401, 403].includes(r.status)) throw reconnect();
  if (r.status >= 400) throw new ApiError(r.status === 404 ? 404 : 502, "The provider could not complete that request.", "provider_request_failed");
  return r.data;
}
