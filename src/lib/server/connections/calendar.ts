import { z } from "zod";
import { ApiError } from "../http";
import { sha256Hex } from "../util";
import { proxy } from "./broker";
import { budget, owned } from "./store";
import { eventSchema, type AccountRow, type ConnectionsEnv } from "./types";

type Calendar = { id: string; name: string; primary: boolean };
async function calendars(env: ConnectionsEnv, row: AccountRow): Promise<Calendar[]> {
  if (row.provider === "googlecalendar") {
    const r = z.object({ items: z.array(z.object({ id: z.string(), summary: z.string().optional(), primary: z.boolean().optional(), accessRole: z.string().optional() })).optional() })
      .parse(await proxy(env, row, "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100&minAccessRole=writer&fields=items(id,summary,primary,accessRole)"));
    return (r.items ?? []).filter(c => ["owner", "writer"].includes(c.accessRole ?? "")).map(c => ({ id: c.id, name: c.summary ?? c.id, primary: c.primary ?? false }));
  }
  const r = z.object({ value: z.array(z.object({ id: z.string(), name: z.string(), isDefaultCalendar: z.boolean().optional(), canEdit: z.boolean().optional() })) })
    .parse(await proxy(env, row, "https://graph.microsoft.com/v1.0/me/calendars?$top=100&$select=id,name,isDefaultCalendar,canEdit"));
  return r.value.filter(c => c.canEdit).map(c => ({ id: c.id, name: c.name, primary: c.isDefaultCalendar ?? false }));
}
export async function listCalendars(env: ConnectionsEnv, accountId: string) {
  await budget(env, accountId); return { calendars: await calendars(env, await owned(env, accountId, "calendar")) };
}
type Receipt = { request_hash: string; result: string | null; broker_id: string; calendar_id: string; event_id: string };
export async function createEvent(env: ConnectionsEnv, accountId: string, input: unknown) {
  const data = eventSchema.parse(input); await budget(env, accountId);
  const hash = await sha256Hex(JSON.stringify({ calendarId: data.calendarId, title: data.title, date: data.date, description: data.description }));
  const prior = await env.DB.prepare("SELECT * FROM connection_event_receipts WHERE account_id = ? AND request_key = ?").bind(accountId, data.idempotencyKey).first<Receipt>();
  if (prior) {
    if (prior.request_hash !== hash) throw new ApiError(409, "Use a new request for a different event.", "idempotency_conflict");
    if (!prior.result) throw new ApiError(409, "The previous save needs checking in your calendar before trying again.", "calendar_write_uncertain");
    return { event: { ...JSON.parse(prior.result) as { id: string; date: string; url?: string }, title: data.title }, replayed: true };
  }
  const row = await owned(env, accountId, "calendar");
  if (!(await calendars(env, row)).some(c => c.id === data.calendarId)) throw new ApiError(404, "Choose a writable calendar from your account.", "calendar_not_found");
  const eventId = (await sha256Hex(`${accountId}:${data.idempotencyKey}`)).slice(0, 40);
  const reserve = await env.DB.prepare("INSERT OR IGNORE INTO connection_event_receipts (account_id, request_key, request_hash, broker_id, calendar_id, event_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(accountId, data.idempotencyKey, hash, row.broker_id, data.calendarId, eventId, Date.now()).run();
  if (reserve.meta?.changes !== 1) throw new ApiError(409, "This calendar save is already being processed.", "calendar_write_uncertain");
  const end = new Date(`${data.date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1); const next = end.toISOString().slice(0, 10);
  const google = row.provider === "googlecalendar";
  const endpoint = google ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(data.calendarId)}/events?sendUpdates=none`
    : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(data.calendarId)}/events`;
  const body = google ? { id: eventId, summary: data.title, description: data.description, start: { date: data.date }, end: { date: next } }
    : { subject: data.title, body: { contentType: "text", content: data.description }, isAllDay: true, start: { dateTime: `${data.date}T00:00:00`, timeZone: "UTC" }, end: { dateTime: `${next}T00:00:00`, timeZone: "UTC" }, transactionId: data.idempotencyKey };
  try {
    const result = z.object({ id: z.string(), htmlLink: z.string().optional(), webLink: z.string().optional() }).parse(await proxy(env, row, endpoint, "POST", body));
    const link = result.htmlLink ?? result.webLink;
    const receipt = { id: result.id, date: data.date, ...(link?.startsWith("https://") ? { url: link } : {}) };
    await env.DB.prepare("UPDATE connection_event_receipts SET event_id = ?, result = ? WHERE account_id = ? AND request_key = ?").bind(result.id, JSON.stringify(receipt), accountId, data.idempotencyKey).run();
    return { event: { ...receipt, title: data.title }, replayed: false };
  } catch { throw new ApiError(409, "Check your calendar before retrying: the save could not be confirmed.", "calendar_write_uncertain"); }
}

/** Cleanup is limited to an event receipt created by this account through this application. */
export async function deleteOwnedEvent(env: ConnectionsEnv, accountId: string, input: unknown) {
  const { idempotencyKey } = z.object({ idempotencyKey: z.string().uuid() }).strict().parse(input);
  await budget(env, accountId);
  const receipt = await env.DB.prepare("SELECT * FROM connection_event_receipts WHERE account_id = ? AND request_key = ?").bind(accountId, idempotencyKey).first<Receipt>();
  if (!receipt?.result) throw new ApiError(404, "Saved event not found.", "not_found");
  const row = await owned(env, accountId, "calendar");
  if (row.broker_id !== receipt.broker_id) throw new ApiError(409, "Reconnect the original calendar account to remove this event.", "connection_reconnect");
  const endpoint = row.provider === "googlecalendar"
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(receipt.calendar_id)}/events/${encodeURIComponent(receipt.event_id)}?sendUpdates=none`
    : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(receipt.calendar_id)}/events/${encodeURIComponent(receipt.event_id)}`;
  await proxy(env, row, endpoint, "DELETE");
  await env.DB.prepare("DELETE FROM connection_event_receipts WHERE account_id = ? AND request_key = ?").bind(accountId, idempotencyKey).run();
  return { ok: true };
}
