"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { connectionsApi, type Category, type Connections, type Provider } from "@/lib/client/onboarding-connections";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import { downloadIcs } from "@/lib/client/ics";
import { CalendarAction } from "./CalendarAction";
import { Loading } from "../States";

const options: { id: Provider; title: string; category: Category; logo: string; purpose: string }[] = [
  { id: "gmail", title: "Gmail", category: "mail", logo: "gmail.png", purpose: "Find relevant messages and review attachments before importing." },
  { id: "outlook", title: "Microsoft Outlook", category: "mail", logo: "outlook.png", purpose: "Find relevant mail and explicitly choose what to import." },
  { id: "googlecalendar", title: "Google Calendar", category: "calendar", logo: "google-calendar.png", purpose: "Add a reviewed date to the calendar you choose." },
  { id: "microsoftcalendar", title: "Microsoft Calendar", category: "calendar", logo: "microsoft-calendar.png", purpose: "Add reviewed dates to your Microsoft / Outlook calendar." },
];
export function ConnectionsStep({ beforeLeave, date, sample = false, returnPath = "/onboarding" }: { beforeLeave(): Promise<void>; date?: string | null; sample?: boolean; returnPath?: "/onboarding" | "/app" }) {
  const [data, setData] = useState<Connections | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<Provider | null>(null);
  const load = useCallback(async () => { try { setData(requireResult(await connectionsApi.get())); setError(""); } catch (e) { setError(operationError(e)); } }, []);
  useEffect(() => { let live = true; void connectionsApi.get().then((result) => { if (!live) return; if (result.ok) setData(result.data); else setError(result.error); }); return () => { live = false; }; }, []);
  async function connect(category: Category, provider: Provider) {
    setBusy(provider); setError("");
    try { await beforeLeave(); const result = requireResult(await connectionsApi.connect(category, provider, returnPath)); const url = new URL(result.redirectUrl); if (url.protocol !== "https:") throw new Error("The connection URL was not valid. Please retry."); window.location.assign(url.href); }
    catch (e) { setError(operationError(e)); setBusy(""); }
  }
  async function disconnect(category: Category) {
    setBusy(category); setError("");
    try { const result = requireResult(await connectionsApi.disconnect(category)); await load(); setNotice(result.providerRevocationRequired ? "Disconnected from Dossierly. Review or remove this app’s permissions separately in your provider account." : "Disconnected from Dossierly."); }
    catch (e) { setError(operationError(e)); }
    finally { setBusy(""); }
  }
  return <div className="op-tools"><p className="op-helper-note">Choose up to one mail provider and one calendar. Connections are optional. Mail content is imported only after you review and accept it.</p>
    {data?.cleanupPending && <div className="op-helper-note" role="status"><p>{data.cleanupNotice || "Your current connection is usable, but removing the previous provider connection still needs attention."}</p><button type="button" className="op-text-button" disabled={!!busy} onClick={() => void load()}>Refresh connection status</button></div>}
    {notice && <p role="status" className="op-helper-note">{notice}</p>}
    {error && <div className="op-error" role="alert">{error}<button type="button" className="op-text-button" onClick={() => void load()}>Retry connection status</button></div>}
    {!data && !error && <Loading label="Checking available connections…" />}
    {(["mail", "calendar"] as const).map((category) => <section className="op-provider-category" key={category}><h2>{category === "mail" ? "Mail" : "Calendar"} <span className="op-help">Optional · one provider</span></h2>
      {options.filter((option) => option.category === category).map((option) => {
        const capability = data?.capabilities.find((item) => item.provider === option.id);
        const connected = data?.connections[category]?.provider === option.id ? data.connections[category] : null;
        return <section className="op-tool" key={option.id} aria-labelledby={`real-tool-${option.id}`}><div className="op-tool-heading"><Image className="op-tool-logo" src={`/onboarding-preview/providers/${option.logo}`} width={36} height={36} alt="" unoptimized /><div><h3 id={`real-tool-${option.id}`}>{option.title}</h3><p className="op-help">{option.purpose}</p></div></div>
          {connected?.status === "connected" ? <div className="op-tool-selection"><span role="status">Connected · {connected.label}</span><button type="button" className="op-text-button" disabled={!!busy} onClick={() => void disconnect(category)}>Disconnect {option.title}</button></div> : <><button type="button" className="op-text-button" disabled={!capability?.available || !!busy} aria-expanded={expanded === option.id} onClick={() => setExpanded(expanded === option.id ? null : option.id)}>{connected ? "Reconnect" : "Set up"} {option.title}</button>{capability && !capability.available && <p className="op-help">{capability.reason || "This connection is not available yet."}</p>}</>}
          {expanded === option.id && <div className="op-permissions"><h4>Review before connecting</h4><p>Connection data passes through Composio and your provider under their privacy and retention policies. Imported copies stay in your encrypted browser vault.</p><p>{category === "mail" ? "You will be asked to approve read-only mail access. Review the provider’s permission screen. Dossierly does not send email." : "You will be asked to approve calendar access. Adding an event remains a separate, explicit action."}</p>{data?.connections[category] && <p>This replaces your current {category} provider after approval.</p>}<button type="button" className="btn" disabled={!!busy} onClick={() => void connect(category, option.id)}>Continue to {option.title}</button></div>}
        </section>;
      })}
      {category === "calendar" && <section className="op-tool"><div className="op-tool-heading"><Image className="op-tool-logo" src="/onboarding-preview/providers/apple-calendar.png" width={36} height={36} alt="" unoptimized /><div><h3>Apple Calendar / calendar file</h3><p className="op-help">Download a reviewed all-day .ics file and choose whether to add it yourself. No Apple sign-in or two-way sync.</p></div></div><button type="button" className="op-text-button" disabled={!date} onClick={() => date && downloadIcs([{ uid: crypto.randomUUID(), date, title: `${sample ? "SAMPLE: " : ""}Reviewed letter date` }], "dossierly-date.ics")}>Download reviewed all-day date (.ics)</button>{!date && <p className="op-help">A reviewed, calculated date is needed before downloading a calendar file.</p>}</section>}
    </section>)}
    {date && data?.connections.calendar?.status === "connected" && <CalendarAction date={date} sample={sample} />}
  </div>;
}
