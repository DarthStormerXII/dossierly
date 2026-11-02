"use client";
import Link from "next/link";
import { useDossier } from "@/lib/client/store";
import { longDate } from "@/lib/client/format";
import { CaseChat } from "../chat/CaseChat";
import { needLabel } from "@/components/onboarding-preview/content";

export function CaseHome() {
  const dossier = useDossier(); const c = dossier.case;
  return <div className="cc-home">
    <header className="cc-home-heading"><div><span className="tab-label">{dossier.sample ? "Fictional sample case" : "Your private case"} · Poland</span><h1>{c.profile.name.split(" ")[0]}’s case</h1><p>{[c.context?.reason, c.context?.stage, c.context?.city].filter(Boolean).join(" · ") || c.type}</p>{c.caseNumber && <p>{c.caseNumber}</p>}</div><Link href="/onboarding?new=1" className="btn btn-small">Start another case</Link></header>
    <nav className="cc-shortcuts" aria-label="Case actions"><Link href="/app/letters">Read a letter</Link><Link href="/app/prepare">Prepare documents</Link><Link href="/app/connections">Mail and calendar</Link><Link href="/app/meet">Communicate at an appointment</Link></nav>
    <CaseChat />
    <details className="cc-case-record"><summary>Reviewed case information</summary>
      {dossier.onboarding && <><h3>Your priorities</h3><ul>{dossier.onboarding.answers.needs.map((need) => <li key={need}>{needLabel(need)} · {dossier.onboarding?.reviews[need]?.state === "reviewed" ? "Reviewed" : "Skipped during setup"}{dossier.onboarding?.notes[need] && <p>{dossier.onboarding.notes[need]}</p>}</li>)}</ul></>}
      <h3>Recorded deadlines</h3>{c.deadlines.length ? <ul>{c.deadlines.map((deadline) => <li key={deadline.id}><strong>{longDate(deadline.date)}</strong> · {deadline.what}</li>)}</ul> : <p>No deadline has been recorded. A new case without a letter has no inferred deadlines.</p>}
      <h3>Documents</h3>{c.documents.length ? <ul>{c.documents.map((item) => <li key={item.name}>{item.name} · {item.have ? "Have" : "Missing / to check"}</li>)}</ul> : <p>No document checklist has been saved yet.</p>}
      {dossier.onboarding?.results?.prepared && <><h3>Prepared phrases</h3>{dossier.onboarding.results.prepared.phrases.map((phrase, i) => <p key={i}><span lang="pl">{phrase.local}</span><br />{phrase.user}</p>)}</>}
      {dossier.onboarding?.results?.interpretation && <><h3>Reviewed translation</h3><p lang="pl">{dossier.onboarding.results.interpretation.translation}</p></>}
      <h3>Case history</h3>{c.events.length ? <ol>{c.events.map((event) => <li key={event.id}><b>{event.title}</b><br />{longDate(event.date)}<p>{event.summary}</p></li>)}</ol> : <p>Your case starts here. Only information you review and save appears in its history.</p>}
    </details>
  </div>;
}
