import { CaseChatPreview, type ChatState } from "./CaseChatPreview";
import { languages, needLabel, officeRelevant, samples, type Answers, type Need } from "./content";
import { demoStatus, orderedNeeds, type Demos } from "./journey";
import { providerName, type Tool } from "./providers";

export function StartingPreview({ answers, demos, chat, updateChat, selected, edit, tryExample, restart }: {
  answers: Answers; demos: Demos; chat: ChatState; updateChat(state: ChatState): void; selected: Tool[]; edit(step: number): void; tryExample(need: Need): void; restart(): void;
}) {
  const order = orderedNeeds(answers);
  const reviewed = order.filter((need) => demos[need]?.phase === 3 && !demos[need]?.skipped).length;
  return <div className="op-start">
    <header className="op-heading"><span className="op-eyebrow">Your starting screen · preview</span><h1 tabIndex={-1} id="op-title">A place to start, {answers.name.trim()}</h1><p>{order.length} help priorities, brought together. {reviewed} sample{reviewed === 1 ? "" : "s"} reviewed.</p></header>
    <CaseChatPreview state={chat} update={updateChat} needs={order} />
    <div className="op-start-grid">
      <section className="op-plans" aria-labelledby="plan-title">
        <div className="op-section-heading"><h2 id="plan-title">Your example plan</h2><button type="button" className="op-text-button" onClick={() => edit(2)}>Edit priorities</button></div>
        <p className="op-help">A suggested path through Dossierly, not an official process checklist. Each next step below is still a sample.</p>
        {order.map((need, index) => <article className="op-plan" key={need} data-plan={need}>
          <div className="op-plan-label"><span className="op-eyebrow">{String(index + 1).padStart(2, "0")} · {needLabel(need)}</span><span className="op-badge">{demoStatus(demos[need])}</span></div>
          <h3>{samples[need].firstAction}</h3>
          <p className="op-action-copy">{demos[need]?.action || samples[need].action}</p>
          <details><summary>Explore this example plan</summary><ol>{samples[need].plan.map((item) => <li key={item}>{item}</li>)}</ol></details>
          <button type="button" className={index === 0 ? "btn btn-primary" : "op-text-button"} onClick={() => tryExample(need)}>{index === 0 ? "Open my first example" : `Open ${needLabel(need).toLowerCase()} example`}<span aria-hidden="true">→</span></button>
        </article>)}
      </section>
      <aside className="op-summary" aria-labelledby="summary-title">
        <div className="op-section-heading"><h2 id="summary-title">Made around your choices</h2><button type="button" className="op-text-button" onClick={() => edit(0)}>Edit details</button></div>
        <dl>
          <div><dt>Your situation</dt><dd>{answers.reason} · {answers.stage}{answers.city.trim() && ` · ${answers.city.trim()}`}</dd></div>
          {officeRelevant(answers.stage) && answers.office.trim() && <div><dt>Office</dt><dd>{answers.office.trim()}</dd></div>}
          <div><dt>First language</dt><dd>{languages.find((item) => item.value === answers.language)?.label}</dd></div>
          <div><dt>Help priorities</dt><dd>{order.map(needLabel).join(" · ")}</dd></div>
          <div><dt>Optional tools</dt><dd>{selected.length ? `${selected.map(providerName).join(", ")} selected for setup` : "Left for later"}</dd></div>
        </dl><button type="button" className="op-text-button" onClick={() => edit(4)}>Edit optional tools</button>
      </aside>
    </div>
    <footer className="op-finish-footer"><p className="op-help">You’re still in the preview. No account, case or connection has been created. Refreshing starts again.</p><div className="op-edit-links"><button type="button" className="op-text-button" onClick={() => edit(4)}>Back</button><button type="button" className="op-text-button" onClick={restart}>Restart preview</button></div></footer>
  </div>;
}
