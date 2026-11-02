import { useEffect, useRef, type ReactNode } from "react";
import { languages, needLabel, samples, type Answers, type Need } from "./content";
import { demoStatus, type Demo, type Demos } from "./journey";
import { paperStories } from "./paper-content";
import { SamplePaper } from "./SamplePaper";

type Props = { answers: Answers; active: Need; order: Need[]; demos: Demos; demo: Demo; select(need: Need): void; update(demo: Demo): void; navigation: ReactNode; error: string };
export function WalkthroughStep({ answers, active, order, demos, demo, select, update, navigation, error }: Props) {
  const sample = samples[active];
  const paper = paperStories[active];
  const language = languages.find((item) => item.value === answers.language)!;
  const focus = useRef<HTMLHeadingElement>(null);
  useEffect(() => { focus.current?.focus({ preventScroll: true }); }, [active, demo.phase]);
  function highlight(evidence: Demo["evidence"]) {
    update({ ...demo, evidence, skipped: false, phase: demo.phase === 0 ? 1 : demo.phase });
    requestAnimationFrame(() => document.getElementById("op-evidence-heading")?.scrollIntoView({ block: "nearest", behavior: "instant" }));
  }
  return <div className="op-walkthrough" data-demo={active}>
    <div className="op-journey-heading"><p role="status">Example {order.indexOf(active) + 1} of {order.length} <span>· every selected priority has its own example</span></p><span className="op-help">Start anywhere. Your edits stay with each example.</span></div>
    <nav aria-label="Selected help examples" className="op-journey-nav">
      <ol>{order.map((need, index) => <li key={need}>
        <button type="button" aria-current={need === active ? "step" : undefined} onClick={() => select(need)}
          aria-label={`Example ${index + 1}: ${needLabel(need)} — ${demoStatus(demos[need])}`}>
          <span className="op-example-number">{demos[need]?.phase === 3 ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <span>{needLabel(need)}<small>{demoStatus(demos[need])}</small></span>
        </button>
      </li>)}</ol>
    </nav>
    <div className="op-workbench">
      <SamplePaper need={active} demo={demo} highlight={highlight} />
      <div className="op-assistant-pane">
        <section className="op-assistant" aria-label="Sample assistant">
          <div className="op-assistant-label"><span className="op-assistant-dot" aria-hidden="true" /><span>Dossierly · sample walkthrough</span></div>
          <div className="op-assistant-intro"><span className="op-eyebrow">{needLabel(active)}</span><h2 ref={focus} tabIndex={-1}>{sample.title}</h2></div>
          {demo.phase === 0 && <div className="op-demo-intro"><p>Meet Arjun. This fictional document gives you something concrete to explore.</p><p className="op-help">Read the original on the left, select a marked passage, or ask for the explanation below. Nothing is analysed or sent to a service.</p></div>}
          {demo.phase > 0 && <section className="op-source-insight" aria-labelledby="op-evidence-heading">
            <div className="op-insight-controls" role="group" aria-label="Source passages">
              {(["request", "detail"] as const).map((kind) => <button type="button" key={kind} aria-pressed={demo.evidence === kind} onClick={() => highlight(kind)}>{paper[kind].label}</button>)}
            </div>
            <h3 id="op-evidence-heading">In plain language</h3>
            <blockquote>{paper[demo.evidence].text}</blockquote>
            <p>{paper[demo.evidence].explanation}</p>
            <button type="button" className="op-text-button" onClick={() => document.getElementById(`source-${active}-${demo.evidence}`)?.focus()}>View highlighted source</button>
          </section>}
          {demo.phase === 1 && <div className="field op-draft">
            <label className="label" htmlFor="sample-action">{sample.actionLabel}</label>
            <textarea id="sample-action" className="input" value={demo.action} maxLength={600} rows={5} aria-invalid={!!error}
              onChange={(event) => update({ ...demo, action: event.target.value, skipped: false })} aria-describedby={error ? "op-error" : "sample-action-help"} />
            <small className="op-help" id="sample-action-help">Edit before review. This draft stays in the preview.</small>
          </div>}
          {demo.phase >= 2 && <section className="op-action-review" aria-labelledby="sample-review-title">
            <span className="op-badge">{demo.phase === 3 ? "Sample confirmed" : "Sample action preview"}</span>
            <h3 id="sample-review-title">{demo.phase === 3 ? "Reviewed, on your terms" : "Does this look right?"}</h3>
            <p className="op-action-copy">{demo.action}</p>
            <p className="op-help">{demo.phase === 3 ? "Only this sample is confirmed. No document, message, reminder or account was changed." : "Review the wording before confirming this sample action."}</p>
            <button className="op-text-button" type="button" onClick={() => update({ ...demo, phase: 1, skipped: false })}>Edit sample action</button>
          </section>}
          {demo.phase === 3 && <div className="op-language-note"><p lang={language.value}>{language.phrase}</p><span className="op-help">A curated phrase in {language.label}. The preview remains in English.</span></div>}
          {navigation}
        </section>
      </div>
    </div>
  </div>;
}
