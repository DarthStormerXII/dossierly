import { useEffect, useRef } from "react";
import { languages, needLabel, samples, type Answers, type Need } from "./content";

export type Demo = { phase: number; action: string };
type Props = { answers: Answers; demo: Demo; update(demo: Demo): void };

export function WalkthroughStep({ answers, demo, update }: Props) {
  const sample = samples[answers.main as Need];
  const language = languages.find((item) => item.value === answers.language)!;
  const focus = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (demo.phase > 0) focus.current?.focus({ preventScroll: true }); }, [demo.phase]);
  return <div className="op-walkthrough" data-demo={answers.main}>
    <div className="op-example-label"><span className="op-badge">Sample</span><span>{needLabel(answers.main)}</span></div>
    {demo.phase < 2 && <article className="op-source" aria-label="Sample source">
      <span className="op-eyebrow">{sample.kind}</span>
      <h2>{sample.title}</h2>
      <p className="op-source-text" lang={answers.main === "letters" || answers.main === "communicate" ? "pl" : "en"}>
        {sample.before}<mark data-highlighted={demo.phase > 0}>{sample.evidence}</mark>{sample.after}
      </p>
      <span className="op-source-foot">Fictional example · not an official instruction</span>
    </article>}
    {demo.phase === 0 && <p className="op-help op-center">Start with the original. Then see the explanation and choose a next step.</p>}
    {demo.phase === 1 && <div className="op-fields op-explanation">
      <section aria-labelledby="demo-explanation">
        <h2 id="demo-explanation" ref={focus} tabIndex={-1}>In plain language</h2>
        <p>{sample.explanation}</p>
        <p className="op-evidence"><span>{sample.evidenceLabel}</span><strong>{sample.evidence}</strong></p>
      </section>
      <label className="field">
        <span>{sample.actionLabel}</span>
        <textarea className="input" value={demo.action} maxLength={600} rows={4}
          onChange={(event) => update({ ...demo, action: event.target.value })} aria-describedby="sample-action-help" />
        <small className="op-help" id="sample-action-help">Edit this sample before you review it. Nothing will be sent or scheduled.</small>
      </label>
    </div>}
    {demo.phase >= 2 && <section className="op-action-review" aria-labelledby="sample-review-title">
      <span className="op-badge">{demo.phase === 3 ? "Sample confirmed" : "Sample action preview"}</span>
      <h2 id="sample-review-title" ref={focus} tabIndex={-1}>{demo.phase === 3 ? "You stay in control" : "Does this look right?"}</h2>
      <p className="op-action-copy">{demo.action}</p>
      <p className="op-help">{demo.phase === 3 ? "This confirmation stays in the preview. No document, message, reminder or account was changed." : "Review the wording before confirming this sample action."}</p>
      <button className="op-text-button" type="button" onClick={() => update({ ...demo, phase: 1 })}>Edit sample action</button>
    </section>}
    {demo.phase === 3 && <div className="op-language-note">
      <p lang={language.value}>{language.phrase}</p>
      <span className="op-help">A curated phrase in {language.label}. This preview stays in English; it doesn’t demonstrate full translation support.</span>
    </div>}
  </div>;
}
