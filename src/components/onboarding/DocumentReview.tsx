import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { todayIso } from "@/lib/client/format";
import type { OnboardingDraft } from "@/lib/client/onboarding-state";
import type { Letter } from "@/lib/client/types";

type Props = { draft: OnboardingDraft; busy: string; change(fn: (d: OnboardingDraft) => OnboardingDraft): void; confirm(): void };
export function DocumentReview({ draft, busy, change, confirm }: Props) {
  const facts = draft.facts;
  if (!facts) return null;
  const edit = (patch: Partial<Letter>) => change((d) => ({ ...d, facts: { ...d.facts!, ...patch }, factsConfirmed: false, link: null, prepared: null, capture: null, interpretation: null, reviews: {} }));
  if (!facts.readable) return <section className="op-error" role="alert"><h2>This page could not be read clearly</h2><p>Choose a sharper photo or another PDF. Nothing has been added to your own case.</p></section>;
  return <section className="ob-review" aria-labelledby="facts-title">
    <span className="op-eyebrow">Extracted from these pages · check before using</span><h2 id="facts-title">Review the facts against the original</h2>
    {!!facts.lowConfidence.length && <p className="op-helper-note">Please check these uncertain items: {facts.lowConfidence.join(", ")}. You can correct the values below.</p>}
    <label className="field"><span>Letter title</span><input className="input" value={facts.title} maxLength={240} onChange={(e) => edit({ title: e.target.value })} /></label>
    <label className="field"><span>Issuing office</span><input className="input" value={facts.office ?? ""} maxLength={160} onChange={(e) => edit({ office: e.target.value || null })} /></label>
    <label className="field"><span>Case number <span className="op-optional">(if stated)</span></span><input className="input" value={facts.caseNumber ?? ""} maxLength={80} onChange={(e) => edit({ caseNumber: e.target.value || null })} /></label>
    <div className="field"><span id="letter-date-label">Date printed on the letter</span><DatePicker labelledBy="letter-date-label" value={facts.dateOnLetter ?? ""} onChange={(dateOnLetter) => edit({ dateOnLetter: dateOnLetter || null })} max={todayIso()} /></div>
    <div className="ob-fact-row"><label className="field"><span>Number of days to reply <span className="op-optional">(only if stated)</span></span><input className="input" type="number" min={0} max={365} value={facts.deadlineRule.days ?? ""} onChange={(e) => edit({ deadlineRule: { ...facts.deadlineRule, days: e.target.value === "" ? null : Math.max(0, Math.min(365, Number(e.target.value))) } })} /></label>
      <div className="field"><span id="deadline-from-label">Count from</span><Select labelledBy="deadline-from-label" value={facts.deadlineRule.from ?? "none"} options={[{ value: "none", label: "Not stated" }, { value: "delivery", label: "Delivery date" }, { value: "letter_date", label: "Date on letter" }]} onChange={(value) => edit({ deadlineRule: { ...facts.deadlineRule, from: value === "none" ? null : value as "delivery" | "letter_date" } })} /></div></div>
    <label className="field"><span>Original sentence about the deadline</span><textarea className="input" rows={3} lang="pl" value={facts.deadlineRule.quote} maxLength={400} onChange={(e) => edit({ deadlineRule: { ...facts.deadlineRule, quote: e.target.value } })} /></label>
    <div className="field"><span id="delivery-label">Date you received this letter</span><DatePicker labelledBy="delivery-label" value={draft.delivery} max={todayIso()} onChange={(delivery) => change((d) => ({ ...d, delivery, factsConfirmed: false, link: null, prepared: null, capture: null, interpretation: null, reviews: {} }))} /><small className="op-help">Use the delivery receipt. If you do not know, leave this unfinished rather than guessing.</small></div>
    <label className="ob-check"><input type="checkbox" checked={draft.factsConfirmed} disabled={!!busy || !draft.delivery || !facts.title.trim()} onChange={(e) => change((d) => ({ ...d, factsConfirmed: e.target.checked }))} /><span>I checked these facts and the delivery date against {draft.source === "sample" ? "the fictional sample" : "my original"}.</span></label>
    <button type="button" className="btn btn-primary" disabled={!!busy || !draft.factsConfirmed} onClick={confirm}>Use these reviewed facts</button>
  </section>;
}
