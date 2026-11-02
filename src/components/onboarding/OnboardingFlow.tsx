"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "../Logo";
import { Loading } from "../States";
import { CaseProvider, useCase } from "@/lib/client/store";
import { LanguageSchema } from "@/lib/schemas";
import type { OnboardingState } from "@/lib/onboarding/schema";
import { useOnboardingDraft } from "@/lib/client/onboarding-draft";
import { useOnboardingWork } from "@/lib/client/onboarding-work";
import { clearDocument, confirmedDossier, freshDraft, orderNeeds } from "@/lib/client/onboarding-state";
import { onboardingApi, operationError, requireResult } from "@/lib/client/onboarding-api";
import { DetailsStep, PrioritiesStep, SituationStep } from "./ProfileSteps";
import { DocumentWorkspace } from "./DocumentWorkspace";
import { ConnectionsStep } from "./ConnectionsStep";
import { MailImport } from "./MailImport";
import { needLabel, type Answers } from "../onboarding-preview/content";

const steps = [
  ["Your details", "A starting point that fits you", "Your profile stays in your encrypted vault on this device."],
  ["Your situation", "Where are you in your journey?", "Choose the context that feels closest. You can update it later."],
  ["Your priorities", "What would make things easier?", "Choose every kind of help you need. Your main priority goes first."],
  ["Your document", "From the original to your next step", "One reading, checked by you, used across all your priorities."],
  ["Optional tools", "Bring your useful things together", "One mail provider and one calendar, both optional."],
  ["Review & save", "Keep your own case together", "Check what will be saved before opening your workspace."],
];
function Flow({ initial, newCase }: { initial: OnboardingState; newCase: boolean }) {
  const router = useRouter(); const context = useCase();
  const { draft: d, change, flush, storageError, retrySave } = useOnboardingDraft(context.me?.accountId, context.phase === "ready" || context.phase === "empty");
  const work = useOnboardingWork(d, change);
  const [server, setServer] = useState(initial); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const currentStep = d?.step;
  useEffect(() => { if (currentStep) { document.getElementById("onboarding-title")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); } }, [currentStep]);
  async function sync(step: number) {
    if (!d) return false;
    const result = await onboardingApi.save({ action: "progress", expectedRevision: server.revision, step, language: LanguageSchema.parse(d.answers.language), needs: orderNeeds(d), reviewedNeeds: d.answers.needs.filter((need) => !!d.reviews[need]) });
    if (!result.ok) {
      if (result.status === 409) { const latest = await onboardingApi.get(); if (latest.ok) setServer(latest.data); }
      setError(result.status === 409 ? "Progress changed in another tab. Your local draft is preserved. Review it, then retry this step." : result.error); return false;
    }
    setServer(result.data); return true;
  }
  async function go(step: number) {
    setError(""); setBusy(true);
    try { await flush(); if (await sync(step)) change((x) => ({ ...x, step })); } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  function update(patch: Partial<Answers>) {
    setError(""); change((x) => {
      const answers = { ...x.answers, ...patch };
      const languageChanged = answers.language !== x.answers.language;
      const contextChanged = ["name", "reason", "stage", "city", "office"].some((key) => answers[key as keyof Answers] !== x.answers[key as keyof Answers]);
      if (languageChanged || contextChanged) return { ...x, answers, read: languageChanged ? null : x.read, factsAccepted: languageChanged ? false : x.factsAccepted, factsConfirmed: languageChanged ? false : x.factsConfirmed, link: null, prepared: null, capture: null, prepareTask: null, interpretation: null, reviews: {}, error: x.pages.length ? languageChanged ? "Your preferred language changed. Read these saved pages again to refresh translated results; no new reading starts until you choose Retry." : "Your case context changed. Refresh the linked guidance and preparation when ready; the original reading is preserved." : "" };
      const reviews = Object.fromEntries(answers.needs.filter((need) => x.reviews[need]).map((need) => [need, x.reviews[need]]));
      return { ...x, answers, reviews, active: answers.needs.includes(x.active) ? x.active : answers.main || answers.needs[0] || "letters" };
    });
  }
  async function next() {
    if (!d) return;
    if (d.step === 1 && !d.answers.name.trim()) { setError("Enter the name you’d like us to use."); document.getElementById("preview-name")?.focus(); return; }
    if (d.step === 2 && (!d.answers.reason || !d.answers.stage)) { setError("Choose your reason for moving and your current stage."); return; }
    if (d.step === 3 && !d.answers.needs.length) { setError("Choose at least one kind of help."); return; }
    await go(d.step + 1);
  }
  async function restart() {
    setBusy(true); setError("");
    try { const result = requireResult(await onboardingApi.save({ action: "restart", expectedRevision: server.revision, confirmed: true })); setServer(result); change(() => freshDraft()); await flush(); }
    catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  async function adopt() {
    if (!context.dossier || context.dossier.sample) return;
    setBusy(true); setError("");
    try { requireResult(await onboardingApi.save({ action: "adopt_existing", expectedRevision: server.revision, caseId: context.dossier.case.id, confirmed: true })); router.replace("/app"); router.refresh(); }
    catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  async function finish() {
    if (!d) return;
    setBusy(true); setError("");
    try {
      if (!replaceConfirmed) throw new Error("Confirm that you want to save this reviewed own case.");
      const dossier = confirmedDossier(d);
      await flush();
      await context.commitOwn(dossier); change((x) => ({ ...x, confirmedCaseId: dossier.case.id })); await flush();
      const result = await onboardingApi.save({ action: "complete", expectedRevision: server.revision, language: LanguageSchema.parse(d.answers.language), needs: orderNeeds(d), reviewedNeeds: d.answers.needs.filter((need) => !!d.reviews[need]), caseId: dossier.case.id, confirmed: true });
      if (!result.ok) { if (result.status === 409) { const latest = requireResult(await onboardingApi.get()); setServer(latest); if (latest.status === "completed" && latest.caseId === dossier.case.id) { router.replace("/app"); router.refresh(); return; } } throw new Error(result.error); }
      router.replace("/app"); router.refresh();
    } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  }
  const unavailable = context.phase === "locked" || context.phase === "unavailable";
  if (unavailable) return <main className="op-preview ob-flow"><div className="op-shell"><h1>{context.phase === "locked" ? "Your existing vault is locked" : "Private storage is unavailable"}</h1><p>{context.phase === "locked" ? "Your stored case is preserved. Use the device and vault access that originally protected it; signing in alone does not unlock an older passkey vault." : "Open Dossierly in a browser that supports IndexedDB to keep your draft encrypted."}</p><Link href="/">Back to Dossierly</Link></div></main>;
  if (!d) return <main className="op-preview ob-flow"><Loading label="Opening your encrypted setup…" />{storageError && <p role="alert">{storageError}</p>}</main>;
  const blocked = busy || !!work.busy;
  const showRestart = server.status === "completed";
  const step = steps[d.step - 1];
  return <main className="op-preview ob-flow" data-step={d.step}><div className="op-shell">
    <header className="op-brand"><Link href="/" prefetch={false} aria-label="Dossierly home"><Logo size={29} /></Link><span className="op-preview-tag">Your setup</span><p>Encrypted on this device · {context.me?.accountKind === "device" ? "device account" : "signed in"}</p></header>
    {(error || storageError) && <div id="op-error" className="op-error" role="alert"><p>{error || storageError}</p>{storageError && <button type="button" className="op-text-button" onClick={retrySave}>Retry saving draft</button>}</div>}
    {showRestart ? <section className="ob-entry"><h1 id="onboarding-title" tabIndex={-1}>Your setup is already complete</h1><p>{context.dossier ? "Your existing local case will stay preserved until you explicitly save a new one." : "Your case is not on this device. Signing in restores setup status, not your encrypted documents."}</p><Link className="btn" href="/app">Open workspace</Link>{newCase && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void restart()}>Start a new case on this device</button>}</section> : <>
      {context.dossier && !context.dossier.sample && !d.confirmedCaseId && d.step === 1 && <section className="ob-legacy"><h2>A case is already saved on this device</h2><p>{context.dossier.case.profile.name} · {context.dossier.case.events.length} saved entries. You can keep it without replacing its history.</p><button type="button" className="btn" disabled={busy} onClick={() => void adopt()}>Keep this existing case and open workspace</button></section>}
      <div className="op-layout" data-wide={d.step === 4 || d.step === 6}><div className="op-context"><div className="op-progress" role="group" aria-label={`Step ${d.step} of 6: ${step[0]}`}><div><span>Step {d.step} of 6</span><span>{step[0]}</span></div><ol>{steps.map((item, i) => <li key={item[0]} data-reached={i < d.step}><span className="sr-only">{item[0]}</span></li>)}</ol></div><header className="op-heading"><h1 id="onboarding-title" tabIndex={-1}>{step[1]}</h1><p>{step[2]}</p></header></div>
      <div className="op-form">
        {d.step <= 3 && <form noValidate onSubmit={(e) => { e.preventDefault(); void next(); }}>{d.step === 1 ? <DetailsStep answers={d.answers} update={update} error={error} /> : d.step === 2 ? <SituationStep answers={d.answers} update={update} error={error} /> : <PrioritiesStep answers={d.answers} update={update} error={error} />}<button className="btn btn-primary ob-continue" disabled={blocked || !!storageError}>Continue →</button></form>}
        {d.step === 4 && <DocumentWorkspace draft={d} change={change} work={work} next={() => void go(5)} empty={() => { change((x) => ({ ...clearDocument(x), source: "empty", reviews: Object.fromEntries(x.answers.needs.map((need) => [need, { state: "skipped", note: "Start without a document; review later." }])) })); void go(5); }} mail={<MailImport beforeConnect={flush} accept={(pages, name) => work.read(pages, name, "mail")} />} />}
        {d.step === 5 && <><ConnectionsStep beforeLeave={flush} date={d.link?.deadline?.date} sample={d.source === "sample"} /><button type="button" className="btn btn-primary" disabled={blocked} onClick={() => void go(6)}>Review my setup</button></>}
        {d.step === 6 && <section className="ob-final"><h2>{d.source === "sample" ? "You explored a fictional case" : `${d.answers.name.trim()}, your case is ready to review`}</h2><p>{d.source === "sample" ? "The sample was read through the real service. Its fictional facts will never become your own case." : d.source === "empty" ? "Your own case starts without a document. Your selected priorities remain useful next steps; no fictional facts are included." : `${d.filename} · ${d.facts?.title || "Reviewed letter"}`}</p><ul>{orderNeeds(d).map((need) => <li key={need}><strong>{needLabel(need)}</strong><span>{d.reviews[need]?.state === "skipped" ? "Explicitly skipped" : "Reviewed"}</span>{d.notes[need] && <p>{d.notes[need]}</p>}</li>)}</ul>{d.source === "sample" ? <button type="button" className="btn btn-primary" disabled={blocked} onClick={() => { change((x) => clearDocument(x)); }}>Start my own case</button> : <><label className="ob-check"><input type="checkbox" checked={replaceConfirmed} onChange={(e) => setReplaceConfirmed(e.target.checked)} /><span>Save this reviewed own case in my encrypted vault on this device. Any earlier local case will be archived.</span></label><button type="button" className="btn btn-primary" disabled={blocked || !replaceConfirmed || !!storageError} onClick={() => void finish()}>{busy ? "Saving your case…" : "Save my own case and open workspace"}</button></>}</section>}
        {d.step > 1 && <button type="button" className="op-text-button ob-back" disabled={blocked} onClick={() => void go(d.step - 1)}>← Back</button>}
      </div></div>
    </>}
  </div></main>;
}
export function OnboardingFlow(props: { initial: OnboardingState; newCase: boolean }) { return <CaseProvider><Flow {...props} /></CaseProvider>; }
