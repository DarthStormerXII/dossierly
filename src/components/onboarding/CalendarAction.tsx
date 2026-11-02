"use client";
import { useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import { connectionsApi } from "@/lib/client/onboarding-connections";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import { longDate } from "@/lib/client/format";

export function CalendarAction({ date, sample }: { date: string; sample: boolean }) {
  const [calendars, setCalendars] = useState<{ id: string; name: string; primary: boolean }[] | null>(null);
  const [calendar, setCalendar] = useState(""); const [title, setTitle] = useState(`${sample ? "SAMPLE: " : ""}Reviewed letter deadline`);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  const key = useRef("");
  async function load() { setBusy(true); setError(""); try { const result = requireResult(await connectionsApi.calendars()); setCalendars(result.calendars); setCalendar(result.calendars.find((item) => item.primary)?.id || result.calendars[0]?.id || ""); } catch (e) { setError(operationError(e)); } finally { setBusy(false); } }
  async function save() {
    setBusy(true); setError("");
    try { if (!key.current) key.current = crypto.randomUUID(); requireResult(await connectionsApi.event({ calendarId: calendar, date, title: `${sample && !title.startsWith("SAMPLE:") ? "SAMPLE: " : ""}${title.trim()}`, idempotencyKey: key.current })); setSaved(true); }
    catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  return <section className="op-permissions" aria-label="Add reviewed calendar event"><h3>Add a date to your connected calendar</h3><p>All-day event · {longDate(date)}. No invitations or attendees.</p>{sample && <p>This is a fictional sample date. Save it only if you want a clearly labelled SAMPLE event in your real calendar.</p>}
    {error && <p role="alert" className="op-error">{error}</p>}
    {saved ? <p role="status">The reviewed all-day event was added to your selected calendar.</p> : !calendars ? <button type="button" className="btn" disabled={busy} onClick={() => void load()}>Choose a calendar and review</button> : calendars.length ? <><div className="field"><span id="event-calendar-label">Calendar</span><Select labelledBy="event-calendar-label" value={calendar} onChange={(value) => { setCalendar(value); key.current = ""; }} options={calendars.map((item) => ({ value: item.id, label: item.name }))} disabled={busy} /></div><label className="field"><span>Event title</span><input className="input" maxLength={160} value={title} disabled={busy} onChange={(e) => { setTitle(e.target.value); key.current = ""; }} /></label><button type="button" className="btn btn-primary" disabled={busy || !title.trim() || !calendar} onClick={() => void save()}>Confirm and add all-day event</button></> : <p>No calendars are available for this connection.</p>}
  </section>;
}
