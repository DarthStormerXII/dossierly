import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { languages, needs, officeRelevant, reasons, stages, type Answers, type Need } from "../onboarding-preview/content";

type Props = { answers: Answers; update(patch: Partial<Answers>): void; error: string };

export function DetailsStep({ answers, update, error }: Props) {
  return <div className="op-fields">
    <label className="field" data-invalid={!!error}>
      <span>Full name</span>
      <input className="input" id="preview-name" autoComplete="off" value={answers.name} maxLength={100}
        onChange={(event) => update({ name: event.target.value })} aria-invalid={!!error}
        aria-describedby={error ? "op-error" : "name-help"} placeholder="The name you go by" />
      <small id="name-help" className="op-help">A single name is fine, too.</small>
    </label>
    <div className="field">
      <span className="label" id="country-label">Where are you settling?</span>
      <Select value="pl" onChange={() => {}} options={[{ value: "pl", label: "Poland" }]} labelledBy="country-label" disabled />
      <small className="op-help">More countries coming soon.</small>
    </div>
    <div className="field">
      <span className="label" id="language-label">Your preferred first language</span>
      <Select value={answers.language} onChange={(language) => update({ language })} options={languages} labelledBy="language-label" />
      <small className="op-help">Explanations and typed translations use this language.</small>
    </div>
  </div>;
}

export function SituationStep({ answers, update, error }: Props) {
  return <div className="op-fields">
    <fieldset className="op-fieldset" aria-describedby={error ? "op-error" : undefined}>
      <legend>What brings you to Poland?</legend>
      <div className="op-reasons">
        {reasons.map((reason) => <label className="op-radio" key={reason}>
          <input type="radio" name="reason" value={reason} checked={answers.reason === reason}
            onChange={() => update({ reason })} />
          <span>{reason}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="field">
      <span className="label" id="stage-label">Where are you in the process?</span>
      <Select id="preview-stage" value={answers.stage} onChange={(stage) => update({ stage })}
        options={stages.map((stage) => ({ value: stage, label: stage }))} labelledBy="stage-label" placeholder="Choose your stage" />
    </div>
    <label className="field">
      <span>City in Poland <span className="op-optional">(optional)</span></span>
      <input className="input" value={answers.city} autoComplete="off" maxLength={100} placeholder="For example, Warsaw"
        onChange={(event) => update({ city: event.target.value })} />
      <small className="op-help">Still deciding? You can leave this blank.</small>
    </label>
    {officeRelevant(answers.stage) && <label className="field">
      <span>Office handling your application <span className="op-optional">(optional)</span></span>
      <input className="input" value={answers.office} autoComplete="off" maxLength={160} placeholder="Office name, if you know it"
        onChange={(event) => update({ office: event.target.value })} />
    </label>}
  </div>;
}

export function PrioritiesStep({ answers, update, error }: Props) {
  function toggle(need: Need, selected: boolean) {
    const next = selected ? [...answers.needs, need] : answers.needs.filter((item) => item !== need);
    update({ needs: next, main: next.includes(answers.main as Need) ? answers.main : next[0] ?? "" });
  }
  return <div className="op-fields">
    <fieldset className="op-fieldset" aria-describedby={error ? "op-error" : "needs-help"}>
      <legend>How can Dossierly help?</legend>
      <p className="op-help" id="needs-help">Choose as many as you need.</p>
      <div className="op-needs">
        {needs.map((need) => <Checkbox key={need.value} className="op-choice" checked={answers.needs.includes(need.value)}
          onChange={(selected) => toggle(need.value, selected)}>
          <span className="op-choice-title">{need.label}</span><span className="op-help">{need.description}</span>
        </Checkbox>)}
      </div>
    </fieldset>
    {answers.needs.length ? <div className="field op-main-priority">
      <span className="label" id="priority-label">What matters most right now?</span>
      <Select value={answers.main} onChange={(main) => update({ main: main as Need })}
        options={answers.needs.map((need) => ({ value: need, label: needs.find((item) => item.value === need)!.label }))}
        labelledBy="priority-label" />
      <small className="op-help">Your first choice starts as the main priority. You can change it here.</small>
    </div> : <p className="op-empty">Choose at least one kind of help to shape your workspace.</p>}
  </div>;
}
