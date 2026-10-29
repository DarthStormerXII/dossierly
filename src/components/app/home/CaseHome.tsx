"use client";

import Link from "next/link";
import { daysUntil, longDate, relDays, shortDate } from "@/lib/client/format";
import { useCase, useDossier } from "@/lib/client/store";
import { Icon } from "../../Icon";
import { DeadlineHero } from "./DeadlineHero";
import { StageTrack } from "./StageTrack";

export function CaseHome() {
  const d = useDossier();
  const { status } = useCase();
  const c = d.case;
  const first = c.profile.name.split(" ")[0];
  const openLetters = d.letters.filter((l) => !l.deadline || daysUntil(l.deadline) >= 0);
  const missing = c.documents.filter((x) => !x.have);
  const events = [...c.events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="page stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">Residence case · Poland</span>
        <h1 className="page-title">{first}&apos;s case</h1>
        <p className="muted case-meta">
          Temporary residence and work · {c.office.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki, ")}
          {c.caseNumber && <><br /><span className="mono">{c.caseNumber}</span></>}
        </p>
      </div>

      <DeadlineHero deadlines={c.deadlines} letters={d.letters} />
      <StageTrack c={c} letters={d.letters.length} />

      <div className="quick">
        <Link className="quick-a" href="/app/prepare"><Icon name="prepare" /><span><b>Prepare</b><small>Checklist from official pages</small></span></Link>
        <Link className="quick-a" href="/app/meet"><Icon name="meet" /><span><b>Meet</b><small>Live two-way interpreting</small></span></Link>
        <Link className="quick-a" href="/app/letters"><Icon name="letter" /><span><b>Read a letter</b><small>Photo or e-Doręczenia PDF</small></span></Link>
      </div>

      <div className="grid-2">
        <section className="card stack" aria-labelledby="letters-h" style={{ ["--gap" as string]: "10px" }}>
          <h2 id="letters-h" className="h-card">Open letters</h2>
          {openLetters.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No open letters. When one arrives, photograph it or upload the PDF and Dossierly links it to your case.</p>
          ) : (
            <ul className="plain-list">
              {openLetters.map((l) => (
                <li key={l.id}>
                  <b>{l.title}</b>
                  <div className="small muted">Received <span className="mono">{shortDate(l.deliveryDate)}</span>{l.deadline && <> · reply by <span className="mono deadline-ink">{shortDate(l.deadline)}</span></>}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack" aria-labelledby="appt-h" style={{ ["--gap" as string]: "10px" }}>
          <h2 id="appt-h" className="h-card">Next appointment</h2>
          {d.nextAppointment ? (
            <>
              <p style={{ margin: 0 }}><span className="mono big-date">{longDate(d.nextAppointment.date)}</span> <span className="muted small">{relDays(d.nextAppointment.date)}</span></p>
              <p className="small" style={{ margin: 0 }}>{d.nextAppointment.purpose}</p>
              <Link href="/app/meet" className="btn btn-small">Open table mode</Link>
            </>
          ) : (
            <>
              <p className="muted small" style={{ margin: 0 }}>None booked in your case.</p>
              <Link href="/app/prepare" className="btn btn-small">Prepare for one</Link>
            </>
          )}
        </section>
      </div>

      <section className="card stack" aria-labelledby="docs-h" style={{ ["--gap" as string]: "10px" }}>
        <div className="row between"><h2 id="docs-h" className="h-card">Documents</h2>{missing.length > 0 && <span className="chip chip-warn">{missing.length} missing</span>}</div>
        {c.documents.length === 0 ? <p className="muted small">Prepare for an appointment and the checklist fills this in.</p> : (
          <ul className="doc-list">
            {c.documents.map((x) => (
              <li key={x.name} className={x.have ? "have" : "missing"}>
                <span className="doc-mark" aria-hidden="true">{x.have ? <Icon name="check" size={16} /> : null}</span>
                <span className="grow">{x.name}</span>
                <span className="tiny muted">{x.have ? "have" : "missing"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="file-h" style={{ ["--gap" as string]: "10px" }}>
        <h2 id="file-h" className="h-card">Case file</h2>
        {events.length === 0 ? <p className="muted small">Nothing yet. Every appointment wrap-up and letter you save lands here, and your agent remembers it.</p> : (
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id} className={`tl-${e.kind}`}>
                <span className="mono tl-date">{shortDate(e.date)}</span>
                <div>
                  <b>{e.title}</b>
                  {e.summary && <p className="small muted" style={{ margin: "2px 0 0" }}>{e.summary}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card card-flat agent-card" aria-labelledby="agent-h">
        <h2 id="agent-h" className="h-card">{d.sample ? "Shared sample agent" : "Your private agent"}</h2>
        <p className="small muted" style={{ margin: "0 0 8px" }}>
          {d.sample
            ? "Everyone trying Arjun's SAMPLE case shares one pinned NemoClaw sandbox. Your own case gets its own sandbox."
            : "One NVIDIA OpenShell sandbox per person, running NemoClaw. It remembers your case between visits."}
        </p>
        <div className="row small">
          <span className={`agent-dot big${status?.bridge.online ? " on" : ""}`} aria-hidden="true" />
          <span>
            {status ? (status.bridge.online ? `Online · ${status.bridge.sandboxes || 1} sandbox${status.bridge.sandboxes === 1 ? "" : "es"} on our hardware` : "Offline right now · tasks run on the cloud fallback (Nemotron 3.5 Super VL)") : "Checking…"}
          </span>
        </div>
        {status?.bridge.lastSeen && <p className="tiny muted mono" style={{ margin: "6px 0 0" }}>last seen {new Date(status.bridge.lastSeen).toLocaleTimeString("en-GB")}</p>}
      </section>
    </div>
  );
}
