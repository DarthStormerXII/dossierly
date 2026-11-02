import { useRef } from "react";
import { needLabel } from "../onboarding-preview/content";
import { clearDocument, orderNeeds, type OnboardingDraft } from "@/lib/client/onboarding-state";
import type { useOnboardingWork } from "@/lib/client/onboarding-work";
import { SourcePane } from "./SourcePane";
import { DocumentReview } from "./DocumentReview";
import { NeedResults, hasNeedResult } from "./NeedResults";
import { Loading } from "../States";

type Props = { draft: OnboardingDraft; change(fn: (d: OnboardingDraft) => OnboardingDraft): void; work: ReturnType<typeof useOnboardingWork>; next(): void; empty(): void; mail?: React.ReactNode };
export function DocumentWorkspace({ draft: d, change, work, next, empty, mail }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const order = orderNeeds(d);
  function review(skipped: boolean) {
    change((x) => {
      const reviews = { ...x.reviews, [x.active]: { state: skipped ? "skipped" as const : "reviewed" as const, note: x.notes[x.active] || "" } };
      const after = [...order.slice(order.indexOf(x.active) + 1), ...order.slice(0, order.indexOf(x.active) + 1)];
      return { ...x, reviews, active: after.find((need) => !reviews[need]) ?? x.active };
    });
    requestAnimationFrame(() => document.getElementById("need-work-title")?.focus());
  }
  const allDone = order.every((need) => d.reviews[need]);
  return <div className="ob-document-workspace">
    {!d.pages.length && <div className="ob-source-picker"><h2>Start with one real reading</h2><p>Use a fictional sample or choose your own letter. The same extracted facts support every priority you selected.</p><div className="ob-source-actions"><button className="btn btn-primary" type="button" disabled={!!work.busy} onClick={() => input.current?.click()}>Choose my letter</button><button className="btn" type="button" disabled={!!work.busy} onClick={() => void work.sample()}>Read the fictional sample</button></div><p className="op-help">PDF, JPEG, PNG or WebP · up to 4 pages and 20 MB. Pages are resized on your device, then sent for reading. Your draft is saved encrypted on this device.</p><button className="op-text-button" type="button" disabled={!!work.busy} onClick={empty}>Start my own case without a letter — skip document review for now</button>{mail}</div>}
    <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden aria-label="Choose letter file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void work.upload(file); e.target.value = ""; }} />
    {d.error && <div className="op-error" role="alert"><p>{d.error}</p>{d.pages.length > 0 && !d.read && <button className="op-text-button" type="button" disabled={!!work.busy} onClick={() => void work.read(d.pages, d.filename, d.source!)}>Retry reading these pages</button>}</div>}
    {!!work.busy && <Loading label={work.busy === "read" ? "Reading the selected pages…" : work.busy === "pages" ? "Preparing pages on your device…" : work.busy === "prepare" ? `Preparing from official sources · ${work.taskState === "running" ? "working" : "waiting"}…` : work.busy === "link" ? "Linking reviewed facts and calculating the date…" : work.busy === "interpret" ? "Translating your phrase…" : "Checking the official-information feed…"} />}
    {!!d.pages.length && <><div className="ob-source-heading"><span>{d.source === "sample" ? "Fictional sample — never saved as your own case" : d.filename}</span><button className="op-text-button" type="button" disabled={!!work.busy} onClick={() => change((x) => clearDocument(x))}>Choose a different letter</button></div>
      {d.factsAccepted && <><p className="op-help">One reading, {order.length} priorities. Select any priority; unfinished ones remain in your journey.</p><nav className="op-journey-nav" aria-label="Selected help priorities"><ol>{order.map((need, i) => <li key={need}><button type="button" disabled={!!work.busy} aria-current={need === d.active ? "step" : undefined} onClick={() => change((x) => ({ ...x, active: need }))}><span className="op-example-number">{i + 1}</span><span>{needLabel(need)}<small>{d.reviews[need]?.state || "Not reviewed"}</small></span></button></li>)}</ol></nav></>}
      <div className="op-workbench"><SourcePane draft={d} reviewFacts={() => change((x) => ({ ...x, factsAccepted: false }))} /><div className="op-assistant-pane"><div className="op-assistant">
        {!d.read ? <p className="op-help">Read these pages to open current extracted facts. Any previous transcript is reference only until you refresh it.</p> : !d.factsAccepted ? <DocumentReview draft={d} busy={work.busy} change={change} confirm={() => change((x) => ({ ...x, factsAccepted: true, active: order[0] }))} /> : <>
          <span className="op-eyebrow">Priority {order.indexOf(d.active) + 1} of {order.length}</span><h2 id="need-work-title" tabIndex={-1}>{needLabel(d.active)}</h2><NeedResults draft={d} change={change} work={work} />
          <label className="field"><span>My next-step note <span className="op-optional">(optional)</span></span><textarea className="input" rows={3} value={d.notes[d.active] || ""} maxLength={600} onChange={(e) => change((x) => ({ ...x, notes: { ...x.notes, [x.active]: e.target.value } }))} /></label>
          <div className="op-navigation"><button type="button" className="btn btn-primary" disabled={!!work.busy || !hasNeedResult(d)} onClick={() => review(false)}>I reviewed this result</button><button type="button" className="op-text-button" disabled={!!work.busy} onClick={() => review(true)}>Skip this priority for now</button>{allDone && <button type="button" className="btn" disabled={!!work.busy} onClick={next}>Continue to optional tools</button>}<button type="button" className="op-text-button" disabled={!!work.busy} onClick={() => change((x) => ({ ...x, factsAccepted: false }))}>Check extracted facts again</button></div>
        </>}
      </div></div></div></>}
  </div>;
}
