import Link from "next/link";

const POINTS = [
  { t: "A sandbox per person", d: "Your agent runs in its own NVIDIA OpenShell sandbox with a network policy. Requests outside the allow-list are blocked and logged." },
  { t: "A ledger of every call", d: "Every model call and every network request your agent makes is written to a hash-chained ledger you can open in the app." },
  { t: "IDs masked first", d: "Your name, case number, PESEL and addresses are replaced with placeholders before any model sees the text." },
  { t: "Encrypted on your device", d: "The case stays in your browser, encrypted with AES-GCM. Email sign-in gives you account access; it does not transfer your saved case." },
  { t: "No training on your data", d: "Nebius does not train on it and every call is sent with storage off. Zero Data Retention is switched on at production launch." },
];

export function PrivacySection() {
  return (
    <section className="section wrap" id="privacy" aria-labelledby="privacy-h">
      <div className="privacy-grid">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="kicker">Privacy you can check</span>
          <h2 id="privacy-h">We don&apos;t say &ldquo;fully private&rdquo;. We show you.</h2>
          <p>Your agent sees your masked case as plain text while it works. Everything else is designed so you can verify it rather than trust us.</p>
          <Link href="/limits" className="small">Read the published limitations →</Link>
        </div>
        <ul className="privacy-list">
          {POINTS.map((p) => (
            <li key={p.t}>
              <b>{p.t}</b>
              <span className="small muted">{p.d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BUILT = [
  "NVIDIA Nemotron 3.5 Lightning",
  "Nemotron 3.5 Super VL",
  "Nemotron 3 Ultra",
  "Nebius Token Factory",
  "NVIDIA NemoClaw + OpenShell",
  "Nemotron embeddings",
  "Tavily",
  "Nebius Serverless Jobs",
  "Cloudflare",
];

export function BuiltOn() {
  return (
    <section className="section wrap" aria-labelledby="built-h">
      <div className="built">
        <span className="kicker" id="built-h">Built on</span>
        <ul className="built-list">{BUILT.map((b) => <li key={b}>{b}</li>)}</ul>
        <p className="small muted" style={{ margin: "14px 0 0", maxWidth: 760 }}>
          Production runs on a Nebius CPU VM pool; before revenue, personal agents run on our own local hardware until our first 10–20 users.
        </p>
      </div>
    </section>
  );
}
