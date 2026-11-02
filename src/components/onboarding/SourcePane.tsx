import { useState } from "react";
import type { OnboardingDraft } from "@/lib/client/onboarding-state";
export function SourcePane({ draft, reviewFacts }: { draft: OnboardingDraft; reviewFacts(): void }) {
  const [enlarged, setEnlarged] = useState(false);
  const quote = draft.facts?.deadlineRule.quote;
  const transcript = draft.facts?.transcript || "";
  const quoteStart = quote ? transcript.indexOf(quote) : -1;
  return <section className="op-document-pane" aria-label="Original document">
    <div className="op-document-toolbar"><span className="op-badge">{draft.source === "sample" ? "SAMPLE · fictional case" : "Your original · stored encrypted on this device"}</span><span>{draft.pages.length} page{draft.pages.length === 1 ? "" : "s"}</span></div>
    <button type="button" className="op-text-button" aria-pressed={enlarged} onClick={() => setEnlarged(!enlarged)}>{enlarged ? "Fit original to reading pane" : "Enlarge original for reading"}</button><p className="op-help">Scroll the original horizontally when enlarged. The extracted text below can reflow on a small screen.</p>
    <div className="ob-pages" data-enlarged={enlarged}>{draft.pages.map((page, index) => <figure className="ob-original" key={index}>
      {/* Local resized pages are intentionally rendered without a remote image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="ob-page-scroll" tabIndex={0} role="region" aria-label={`Scrollable original page ${index + 1}`}><img src={page} alt={`${draft.source === "sample" ? "Fictional sample" : "Uploaded letter"}, page ${index + 1}`} /></div>
      <figcaption>{draft.source === "sample" ? "SAMPLE — not your own case" : draft.filename} · Page {index + 1}</figcaption>
    </figure>)}</div>
    {draft.facts?.transcript && <details className="ob-transcript" open><summary>Read the extracted Polish text</summary><p lang="pl">{quoteStart >= 0 && quote ? <>{transcript.slice(0, quoteStart)}<mark>{quote}</mark>{transcript.slice(quoteStart + quote.length)}</> : transcript}</p>{quoteStart >= 0 && <button type="button" className="op-text-button" onClick={reviewFacts}>Review the highlighted date rule</button>}</details>}
  </section>;
}
