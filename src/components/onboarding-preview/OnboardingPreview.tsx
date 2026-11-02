"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DetailsStep, PrioritiesStep, SituationStep } from "./SetupSteps";
import { WalkthroughStep, type Demo } from "./WalkthroughStep";
import { ToolsStep } from "./ToolsStep";
import { StartingPreview } from "./StartingPreview";
import { emptyAnswers, samples, steps, type Answers, type Need, type Tool } from "./content";

export function OnboardingPreview() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [demo, setDemo] = useState<Demo>({ phase: 0, action: "" });
  const [selectedTools, setSelectedTools] = useState<Tool[]>([]);
  const [expandedTool, setExpandedTool] = useState<Tool | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.getElementById("op-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  function update(patch: Partial<Answers>) {
    const next = { ...answers, ...patch };
    if (next.main !== answers.main) setDemo({ phase: 0, action: next.main ? samples[next.main].action : "" });
    setAnswers(next);
    setError("");
  }

  function go(next: number) { setError(""); setStep(next); }

  function fail(message: string, selector: string) {
    setError(message);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0 && !answers.name.trim()) return fail("Enter the name you’d like us to use.", "#preview-name");
    if (step === 1 && !answers.reason) return fail("Choose what brings you to Poland.", 'input[name="reason"]');
    if (step === 1 && !answers.stage) return fail("Choose your current stage. “Not sure” is an option.", "#preview-stage");
    if (step === 2 && !answers.needs.length) return fail("Choose at least one kind of help to continue.", '.op-needs input');
    if (step === 3 && demo.phase === 1 && !demo.action.trim()) return fail("Add a sample next step before reviewing it.", ".op-walkthrough textarea");
    if (step === 3 && demo.phase < 3) { setError(""); setDemo({ ...demo, phase: demo.phase + 1 }); return; }
    go(step + 1);
  }

  function selectTool(tool: Tool) {
    const wasSelected = selectedTools.includes(tool);
    setSelectedTools((selected) => selected.includes(tool) ? selected.filter((item) => item !== tool) : [...selected, tool]);
    setExpandedTool(null);
    requestAnimationFrame(() => document.getElementById(`${wasSelected ? "preview" : "remove"}-tool-${tool}`)?.focus());
  }

  function restart() {
    setAnswers(emptyAnswers()); setDemo({ phase: 0, action: "" });
    setSelectedTools([]); setExpandedTool(null); go(0);
  }

  const primary = step === 3 ? ["Explain this sample", "Preview sample action", "Confirm sample action", "Continue"][demo.phase]
    : step === 4 ? "See my starting screen" : "Continue";

  return <main className="op-preview" data-step={step + 1}>
    <div className="op-shell">
      <header className="op-brand">
        <Link href="/" prefetch={false} aria-label="Back to Dossierly"><Logo size={27} /></Link>
        <div><span className="op-preview-tag">Onboarding preview</span><p>Try the setup. Your choices stay in this tab.</p></div>
      </header>
      {step < 5 ? <>
        <div className="op-progress" role="group" aria-label={`Step ${step + 1} of 5: ${steps[step].label}`}>
          <div><span>Step {step + 1} of 5</span><span>{steps[step].label}</span></div>
          <ol>{steps.map((item, index) => <li key={item.label} data-reached={index <= step} aria-current={step === index ? "step" : undefined}><span className="sr-only">{item.label}</span></li>)}</ol>
        </div>
        <form className="op-form" onSubmit={next} noValidate aria-labelledby="op-title">
          <header className="op-heading">
            <h1 id="op-title" tabIndex={-1}>{steps[step].title}</h1>
            <p>{step === 3 ? `${answers.name.trim()}, here’s an example of help with ${samples[answers.main as Need].firstAction.toLowerCase().replace(/^(understand|start|review|prepare) /, "")}.` : steps[step].description}</p>
          </header>
          {step === 0 && <DetailsStep answers={answers} update={update} error={error} />}
          {step === 1 && <SituationStep answers={answers} update={update} error={error} />}
          {step === 2 && <PrioritiesStep answers={answers} update={update} error={error} />}
          {step === 3 && <WalkthroughStep answers={answers} demo={demo} update={(value) => { setError(""); setDemo(value); }} />}
          {step === 4 && <ToolsStep selected={selectedTools} expanded={expandedTool} expand={setExpandedTool} select={selectTool} />}
          {error && <p id="op-error" className="op-error" role="alert">{error}</p>}
          <footer className="op-navigation">
            <button className="btn btn-primary" type="submit">{primary}<span aria-hidden="true">→</span></button>
            <div className="op-nav-secondary">
              {step > 0 ? <button className="op-text-button" type="button" onClick={() => go(step - 1)}><span aria-hidden="true">←</span> Back</button> : <span className="op-help">Five short steps. Yours to explore.</span>}
              {step === 3 && <button className="op-text-button" type="button" onClick={() => go(4)}>Skip example</button>}
              {step === 4 && <button className="op-text-button" type="button" onClick={() => { setSelectedTools([]); setExpandedTool(null); go(5); }}>Connect later</button>}
            </div>
          </footer>
        </form>
      </> : <StartingPreview answers={answers} selected={selectedTools} edit={go} restart={restart}
        tryExample={() => { setDemo({ ...demo, phase: 0 }); go(3); }} />}
    </div>
  </main>;
}
