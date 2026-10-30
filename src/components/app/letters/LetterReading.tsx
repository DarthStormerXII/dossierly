"use client";

import { useState } from "react";
import { longDate, todayIso } from "@/lib/client/format";
import type { LetterRead } from "@/lib/client/types";
import { Attribution } from "../../Attribution";
import { DatePicker } from "../../ui/DatePicker";

const KIND: Record<string, string> = {
  wezwanie_braki_formalne: "Wezwanie · missing documents",
  decision: "Decyzja · decision",
  card_collection: "Card collection notice",
  fingerprint_appointment: "Fingerprint appointment",
  proceedings_extension: "Proceedings extended",
  other: "Official letter",
};

function confirmValue(read: LetterRead, key: string): { label: string; value: string } {
  const l = read.letter;
  if (key.startsWith("dateOnLetter")) return { label: "Date on letter", value: l.dateOnLetter ? longDate(l.dateOnLetter) : "not found" };
  if (key.startsWith("caseNumber")) return { label: "Case number", value: l.caseNumber ?? "not found" };
  if (key.startsWith("deadlineRule")) return { label: "Days to reply", value: l.deadlineRule.days !== null ? `${l.deadlineRule.days} days` : "not stated" };
  return { label: key.replace(/[._]/g, " "), value: "" };
}

type Props = { read: LetterRead; delivery: string; onDelivery(v: string): void; onLink(): void; linking: boolean; linked: boolean };

export function LetterReading({ read, delivery, onDelivery, onLink, linking, linked }: Props) {
  const l = read.letter;
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const low = [...new Set(l.lowConfidence.map((k) => k.split(".")[0] === "deadlineRule" ? "deadlineRule" : k.split(".")[0]))];

  if (!l.readable) {
    return (
      <section className="card" role="alert">
        <h2 className="h-card">We could not read this page</h2>
        <p className="muted">{l.title || "The image is unclear."} Try a sharper photo in daylight, flat, with all four corners visible.</p>
      </section>
    );
  }

  return (
    <section className="stack" aria-labelledby="letter-h" style={{ ["--gap" as string]: "14px" }}>
      <div className="card letter-head">
        <div className="row between">
          <span className="chip chip-official">{KIND[l.kind] ?? KIND.other}</span>
          <Attribution runs={read.runs} run={read.run} />
        </div>
        <h2 id="letter-h" style={{ margin: "10px 0 6px" }}>{l.title}</h2>
        <dl className="facts">
          {l.office && <div><dt>From</dt><dd>{l.office}</dd></div>}
          {l.caseNumber && <div><dt>Case number</dt><dd className="mono">{l.caseNumber}</dd></div>}
          {l.dateOnLetter && <div><dt>Dated</dt><dd className="mono">{longDate(l.dateOnLetter)}</dd></div>}
        </dl>
        {low.length > 0 && (
          <div className="confirm-row" aria-label="Please confirm">
            <span className="small" style={{ fontWeight: 650 }}>Please confirm against the paper:</span>
            {low.map((k) => {
              const v = confirmValue(read, k);
              const ok = confirmed.includes(k);
              return (
                <button key={k} type="button" className={`chip ${ok ? "chip-ok" : "chip-warn"}`} aria-pressed={ok} onClick={() => setConfirmed((c) => (ok ? c.filter((x) => x !== k) : [...c, k]))}>
                  {ok ? "✓ " : ""}{v.label}{v.value ? `: ${v.value}` : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="two-up">
        <article className="card transcript" aria-label="Polish text, exactly as printed" lang="pl">
          <span className="tab-label">Polish original · verbatim</span>
          <p className="transcript-text">{l.transcript || "—"}</p>
        </article>
        <article className="card stack" aria-label="What it asks" style={{ ["--gap" as string]: "12px" }}>
          <span className="tab-label">What it asks you to do</span>
          <ol className="asks">
            {l.asks.map((a, i) => (
              <li key={i}>
                <span>{a}</span>
                {l.asksLocal[i] && <span className="asks-pl" lang="pl">„{l.asksLocal[i]}”</span>}
              </li>
            ))}
          </ol>
          {l.deadlineRule.quote && (
            <div className="rule-quote">
              <span className="tab-label">The sentence that sets the deadline</span>
              <p lang="pl" style={{ margin: "4px 0 0" }}>„{l.deadlineRule.quote}”</p>
            </div>
          )}
          {l.fields.length > 0 && (
            <details>
              <summary className="small" style={{ fontWeight: 650 }}>Form fields explained ({l.fields.length})</summary>
              <ul className="small" style={{ marginTop: 8 }}>
                {l.fields.map((f) => <li key={f.label}><b lang="pl">{f.label}</b>: {f.meaning}{f.howToFill && ` ${f.howToFill}`}</li>)}
              </ul>
            </details>
          )}
        </article>
      </div>

      {!linked && (
        <div className="card stack delivery" style={{ ["--gap" as string]: "12px" }}>
          <h2 className="h-card">When did you receive it?</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Polish deadlines usually count from the day of delivery, not the date printed on the letter. Use the day you signed for it at the post office, or the date on the e-Doręczenia delivery receipt.
          </p>
          <div className="row">
            <DatePicker id="delivery-date" ariaLabel="Delivery date" value={delivery} max={todayIso()} onChange={onDelivery} placeholder="Choose the delivery day" />
            <button className="btn btn-primary" onClick={onLink} disabled={linking || !delivery}>{linking ? "Linking…" : "Link to my case and count the deadline"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
