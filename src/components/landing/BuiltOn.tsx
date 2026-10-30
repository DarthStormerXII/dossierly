const STACK = [
  { name: "Nebius Token Factory", job: "Every model call, with storage off" },
  { name: "NVIDIA Nemotron 3.5 Lightning", job: "Interpreted turns and the interpret-only guard" },
  { name: "NVIDIA Nemotron 3.5 Super VL", job: "Your agent, letter reading and the watcher" },
  { name: "NVIDIA Nemotron 3 Ultra", job: "Linking a new letter to the whole case" },
  { name: "NVIDIA NemoClaw / OpenShell", job: "One sandbox per person, with an audit log" },
  { name: "NVIDIA NeMo Guardrails", job: "Audits the interpret-only rule" },
  { name: "Tavily", job: "Official Polish pages, searched and cited" },
  { name: "Dodo Payments", job: "Merchant of record at checkout" },
];

/** Built on: a quiet, logo-free grid where each name says what it does. */
export function BuiltOn() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="built-h">
      <div className="lp-head lp-head-row" data-reveal>
        <div>
          <span className="lp-kicker">Built on</span>
          <h2 id="built-h">Each model has the job it fits.</h2>
        </div>
        <p>Nemotron models on Nebius Token Factory do the thinking. NVIDIA&apos;s sandbox keeps each agent apart.</p>
      </div>
      <ul className="lp-stack" data-reveal>
        {STACK.map((s) => (
          <li key={s.name}>
            <b>{s.name}</b>
            <span>{s.job}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
