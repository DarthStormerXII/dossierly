import type { Case } from "@/lib/client/types";

const STAGES = [
  { id: "apply", label: "Applied in MOS" },
  { id: "prints", label: "Fingerprints" },
  { id: "letters", label: "Office letters" },
  { id: "decision", label: "Decision" },
  { id: "card", label: "Card collection" },
] as const;

/** Where the case stands, inferred from the case file. Done stages are filled; the current one is outlined. */
export function StageTrack({ c, letters }: { c: Case; letters: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const text = (e: Case["events"][number]) => `${e.title} ${e.summary}`.toLowerCase();
  const has = (re: RegExp) => c.events.some((e) => re.test(text(e)));
  const done = [
    has(/mos|applied|wniosek|application/),
    has(/fingerprint|odcisk/),
    (letters > 0 || c.events.some((e) => e.kind === "letter")) && !c.deadlines.some((x) => x.date >= today),
    c.events.some((e) => /^(decision|decyzja)/i.test(e.title)),
    c.events.some((e) => /card collected|karta odebrana/i.test(e.title)),
  ];
  const current = done.findIndex((x) => !x);

  return (
    <section className="card stage" aria-label="Case stages">
      <ol className="stage-track">
        {STAGES.map((s, i) => {
          const state = done[i] ? "done" : i === current ? "now" : "later";
          return (
            <li key={s.id} className={`st-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="st-dot" aria-hidden="true" />
              <span className="st-label">{s.label}</span>
              <span className="sr-only">{state === "done" ? "done" : state === "now" ? "current stage" : "later"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
