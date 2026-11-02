import { languages, needLabel, officeRelevant, samples, type Answers, type Need, type Tool } from "./content";

export function StartingPreview({ answers, selected, edit, tryExample, restart }: {
  answers: Answers; selected: Tool[]; edit(step: number): void; tryExample(): void; restart(): void;
}) {
  const sample = samples[answers.main as Need];
  return <div className="op-start">
    <header className="op-heading">
      <span className="op-eyebrow">Your starting screen · preview</span>
      <h1 tabIndex={-1} id="op-title">A place to start, {answers.name.trim()}</h1>
      <p>Here’s how your choices could shape Dossierly.</p>
    </header>
    <section className="op-first-action" aria-labelledby="first-action-title">
      <span className="op-eyebrow">Start with what matters most</span>
      <h2 id="first-action-title">{sample.firstAction}</h2>
      <p>A useful first step for your {answers.reason.toLowerCase() === "other" ? "journey" : answers.reason.toLowerCase() + " journey"}{answers.city.trim() ? ` in ${answers.city.trim()}` : " in Poland"}.</p>
      <button type="button" className="btn btn-primary" onClick={tryExample}>Try the sample <span aria-hidden="true">→</span></button>
    </section>
    <section className="op-plan" aria-labelledby="plan-title">
      <h2 id="plan-title">An example plan</h2>
      <ol>{sample.plan.map((item, index) => <li key={item}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol>
      <p className="op-help">This is a suggested path through the product, not an official process checklist.</p>
    </section>
    <section className="op-summary" aria-labelledby="summary-title">
      <div className="op-section-heading"><h2 id="summary-title">Made around your choices</h2><button type="button" className="op-text-button" onClick={() => edit(0)}>Edit details</button></div>
      <dl>
        <div><dt>Your situation</dt><dd>{answers.reason} · {answers.stage}{answers.city.trim() && ` · ${answers.city.trim()}`}</dd></div>
        {officeRelevant(answers.stage) && answers.office.trim() && <div><dt>Office</dt><dd>{answers.office.trim()}</dd></div>}
        <div><dt>First language</dt><dd>{languages.find((item) => item.value === answers.language)?.label}</dd></div>
        <div><dt>Help priorities</dt><dd>{answers.needs.map(needLabel).join(" · ")}</dd></div>
        <div><dt>Optional tools</dt><dd>{selected.length ? `${selected.map((tool) => tool === "gmail" ? "Gmail" : "Google Calendar").join(" and ")} selected for setup` : "Left for later"}</dd></div>
      </dl>
      <div className="op-edit-links"><button type="button" className="op-text-button" onClick={() => edit(2)}>Edit priorities</button><button type="button" className="op-text-button" onClick={() => edit(4)}>Edit optional tools</button></div>
    </section>
    <footer className="op-finish-footer">
      <p className="op-help">You’re still in the preview. No account, case or connection has been created. Refreshing starts again.</p>
      <div className="op-edit-links"><button type="button" className="op-text-button" onClick={() => edit(4)}>Back</button><button type="button" className="op-text-button" onClick={restart}>Restart preview</button></div>
    </footer>
  </div>;
}
