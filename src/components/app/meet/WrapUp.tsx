"use client";

import Link from "next/link";
import { useState } from "react";
import { isIsoDate, longDate, todayIso } from "@/lib/client/format";
import { downloadIcs } from "@/lib/client/ics";
import { newId, useDossier } from "@/lib/client/store";
import type { CaseEvent, TurnInput, WrapResult } from "@/lib/client/types";
import { Attribution } from "../../Attribution";
import { Icon } from "../../Icon";
import { useFiling } from "../useFiling";

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="card stack" style={{ ["--gap" as string]: "8px" }}>
      <h2 className="h-card">{title}</h2>
      {items.length ? <ul className="wrap-list">{items.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>{empty}</p>}
    </section>
  );
}

export function WrapUp({ wrap, turns }: { wrap: WrapResult; turns: TurnInput[] }) {
  const d = useDossier();
  const s = wrap.summary;
  const filing = useFiling();
  const [saved, setSaved] = useState(false);
  // A date already in the past was most likely guessed from words like "the tenth"; it is shown but not saved as a deadline.
  const future = (x: { date: string }) => isIsoDate(x.date) && x.date >= todayIso();
  const datedNext = s.nextDates.filter(future);

  const save = async () => {
    const id = newId("ev-wrap");
    const summary = [s.headline, s.agreed.length ? `Agreed: ${s.agreed.join("; ")}` : "", s.bring.length ? `Bring: ${s.bring.join("; ")}` : "", s.openQuestions.length ? `Open: ${s.openQuestions.join("; ")}` : ""].filter(Boolean).join(" ").slice(0, 1500);
    const event: CaseEvent = { id, date: todayIso(), kind: "wrap", title: `Appointment at ${d.case.office.replace("Wydział Spraw Cudzoziemców MUW - ", "")}`.slice(0, 200), summary };
    const nextCase = {
      ...d.case,
      events: [...d.case.events, event].slice(-60),
      deadlines: [...d.case.deadlines, ...datedNext.map((x) => ({ id: newId("dl"), date: x.date, what: x.what.slice(0, 300), sourceEventId: id }))].slice(-30),
      documents: [...d.case.documents, ...s.bring.filter((b) => !d.case.documents.some((x) => x.name === b)).map((b) => ({ name: b.slice(0, 160), have: false }))].slice(0, 40),
    };
    await d.update((x) => ({ ...x, case: nextCase }));
    setSaved(true);
    filing.file(nextCase, event);
  };

  const ics = () => downloadIcs(datedNext.map((x, i) => ({ uid: `wrap-${i}-${x.date}`, date: x.date, title: x.what, description: "From your Dossierly appointment wrap-up." })), "dossierly-appointment.ics");

  return (
    <div className="page stack" style={{ ["--gap" as string]: "16px" }}>
      <div>
        <span className="tab-label">After · wrap-up</span>
        <h1 className="page-title">What was agreed</h1>
        <div className="row between">
          <p className="muted" style={{ margin: 0 }}>From {turns.length} interpreted turns. Only what was actually said.</p>
          <Attribution run={wrap.run} />
        </div>
      </div>
      <div className="card headline-card"><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 650 }}>{s.headline}</p></div>
      <List title="Agreed" items={s.agreed} empty="Nothing was explicitly agreed." />
      <List title="Bring next time" items={s.bring} empty="No documents were requested." />
      <section className="card stack" style={{ ["--gap" as string]: "8px" }}>
        <h2 className="h-card">Dates</h2>
        {s.nextDates.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No dates were mentioned.</p> : (
          <ul className="plain-list">
            {s.nextDates.map((x) => (
              <li key={x.date + x.what}>
                <span className={`mono ${future(x) ? "deadline-ink" : ""}`}>{isIsoDate(x.date) ? longDate(x.date) : x.date}</span>
                {isIsoDate(x.date) && !future(x) && <span className="chip chip-warn" style={{ marginLeft: 8 }}>unclear: check the month</span>}
                <div className="small">{x.what}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <List title="Open questions" items={s.openQuestions} empty="No open questions." />
      <div className="card stack save-bar" style={{ ["--gap" as string]: "10px" }}>
        {saved ? (
          <>
            <p style={{ margin: 0, fontWeight: 650 }}><Icon name="check" size={18} /> Saved to your case.</p>
            <p className="small muted" style={{ margin: 0 }}>{filing.label}</p>
            <div className="row">
              {datedNext.length > 0 && <button className="btn btn-small" onClick={ics}><Icon name="calendar" size={18} /> Calendar (.ics)</button>}
              <Link href="/app" className="btn btn-small btn-primary">Back to case</Link>
            </div>
          </>
        ) : (
          <div className="row">
            <button className="btn btn-primary" onClick={() => void save()}>Save to case</button>
            {datedNext.length > 0 && <button className="btn" onClick={ics}><Icon name="calendar" size={18} /> Calendar file</button>}
          </div>
        )}
        <p className="tiny muted" style={{ margin: 0 }}>The conversation text is not kept after you leave this screen; only this wrap-up is saved, encrypted on your device.</p>
      </div>
    </div>
  );
}
