import Link from "next/link";

/** The hero carries the whole story as a case file: what was said, the letter, the link, the deadline. */
export function Hero() {
  return (
    <section className="hero wrap">
      <div className="hero-copy">
        <span className="kicker">Personal AI caseworker · Poland</span>
        <h1>Your residence case, remembered.</h1>
        <p className="hero-sub">
          Dossierly prepares you for the office, interprets at the desk, reads the letter that follows and counts the deadline.
          Each person gets a private agent that remembers their case from one visit to the next.
        </p>
        <div className="row hero-cta">
          <Link className="btn btn-primary" href="/app?start=sample">Start with Arjun&apos;s sample case</Link>
          <Link className="btn" href="/app">Start my own case</Link>
        </div>
        <p className="tiny muted" style={{ marginTop: 14 }}>
          Interprets and explains. Not legal or medical advice. First letter free.
        </p>
      </div>

      <figure className="hero-file" aria-label="Example: Arjun's case file">
        <div className="hf-tab">WSC-II-P.6151.48213.2026 <span className="stamp" style={{ marginLeft: 8 }}>SAMPLE</span></div>
        <div className="hf-body">
          <div className="hf-entry">
            <span className="mono hf-date">18 Sep</span>
            <div>
              <span className="hf-kind">At the desk · fingerprints</span>
              <p className="hf-pl" lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego. Przyjdzie pismo.”</p>
              <p className="hf-en">Proof of health insurance is missing. A letter will follow.</p>
            </div>
          </div>
          <div className="hf-entry">
            <span className="mono hf-date">27 Oct</span>
            <div>
              <span className="hf-kind">Letter · wezwanie</span>
              <p className="hf-pl" lang="pl">„…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”</p>
              <p className="hf-link">Linked: this is the letter the official mentioned on 18 Sep.</p>
            </div>
          </div>
          <div className="hf-deadline">
            <span className="tab-label" style={{ color: "var(--deadline)" }}>Reply by</span>
            <span className="mono hf-dl">Tue, 10 Nov 2026</span>
            <span className="tiny muted">27 Oct + 14 days. Delivery day not counted. Counted in code.</span>
          </div>
        </div>
      </figure>
    </section>
  );
}
