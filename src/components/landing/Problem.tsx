/** The problem, told through one real case shape: long, in Polish, and run by deadlines. */
const MILESTONES = [
  { at: 0, label: "Applied" },
  { at: 27, label: "Fingerprints" },
  { at: 37, label: "Wezwanie" },
  { at: 100, label: "Decision" },
];

export function Problem() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="problem-h">
      <div className="lp-dark">
        <div className="lp-head lp-head-dark" data-reveal>
          <span className="lp-kicker">The problem</span>
          <h2 id="problem-h">A residence case in Poland is long, in Polish, and run by deadlines.</h2>
        </div>

        <div className="lp-prob-grid">
          <article className="lp-prob lp-prob-wide" data-reveal>
            <p className="lp-stat"><span>394</span> days</p>
            <p className="lp-prob-text">
              The average residence case at the Mazowiecki voivodeship office in Warsaw in 2026. More than a year of
              appointments and letters to keep straight.
            </p>
            <div className="lp-timeline" aria-hidden="true">
              <div className="lp-tl-bar"><span className="lp-tl-fill" /></div>
              {MILESTONES.map((m) => (
                <span key={m.label} className="lp-tl-mark" style={{ left: `${m.at}%` }}><i />{m.label}</span>
              ))}
            </div>
            <p className="lp-src">Source: reply to Sejm interpellation 18089</p>
          </article>

          <article className="lp-prob" data-reveal>
            <h3>The conversation happens in Polish, at the counter.</h3>
            <div className="lp-bubble" lang="pl">„Przyjdzie pismo. Proszę pilnować terminu.”</div>
            <p className="lp-prob-text">A few minutes, a queue behind you, and the details that decide your case.</p>
          </article>

          <article className="lp-prob" data-reveal>
            <h3>A <i lang="pl">wezwanie</i> gives you 14 days from delivery.</h3>
            <blockquote className="lp-quote" lang="pl">
              „…w terminie <mark>14 dni od dnia doręczenia</mark> niniejszego wezwania…”
            </blockquote>
            <p className="lp-prob-text">Miss it and the application is left unexamined.</p>
          </article>

          <article className="lp-prob" data-reveal>
            <h3>Help either forgets, or costs a fortune.</h3>
            <dl className="lp-vs">
              <div><dt>Translation apps</dt><dd>One sentence at a time, then they forget everything.</dd></div>
              <div><dt>Agencies</dt><dd>Remember the case, and cost thousands of złoty.</dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}
