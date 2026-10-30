import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { PhotoCard } from "./Photo";

const TICKS = Array.from({ length: 14 }, (_, i) => i + 1);

/** Hero: the promise on the left, the sample case living on top of a Warsaw street on the right. */
export function Hero() {
  return (
    <section className="lp-hero lp-wrap" aria-labelledby="hero-h">
      <div className="lp-hero-copy" data-reveal>
        <span className="lp-eyebrow"><span className="lp-dot" aria-hidden="true" />Now in Poland · Mazowieckie</span>
        <h1 id="hero-h">A caseworker for your life abroad.</h1>
        <p className="lp-lede">
          Dossierly gives you a private AI agent that remembers your whole residence case. It prepares you for the
          office, interprets at the counter, reads the letters that follow and counts every deadline.
        </p>
        <div className="lp-ctas">
          <Link className="lp-btn lp-btn-dark" href="/signup">
            Get started free <span className="lp-btn-ic" aria-hidden="true"><Icon name="arrow" size={18} /></span>
          </Link>
          <Link className="lp-btn lp-btn-light" href="/signup?start=sample">See the sample case</Link>
        </div>
        <p className="lp-hero-note">
          The sample is Arjun Raman, a fictional applicant. His office, his letter type and his deadline rules are real.
        </p>
      </div>

      <div className="lp-hero-visual" data-reveal>
        <PhotoCard
          src="/landing/hero-city.jpg"
          alt="An evening street in Warsaw, the city where Dossierly's first cases live"
          tone="dusk"
          className="lp-hero-card"
        >
          <span className="lp-glass-chip lp-hero-agent">
            <span className="lp-live" aria-hidden="true" />Agent online · private sandbox
          </span>
          <span className="lp-glass-chip lp-hero-place">Warsaw, Poland</span>

          <div className="lp-float lp-float-interp" aria-label="An interpreted line from the counter">
            <div className="lp-turn lp-turn-off">
              <span className="lp-turn-who">Official · Polish</span>
              <p lang="pl">„Brakuje potwierdzenia ubezpieczenia zdrowotnego.”</p>
            </div>
            <div className="lp-turn lp-turn-you">
              <span className="lp-turn-who">For you · English</span>
              <p>Proof of health insurance is missing.</p>
            </div>
          </div>

          <div className="lp-float lp-float-deadline" aria-label="Deadline for Arjun's wezwanie">
            <div className="lp-dl-head">
              <span className="lp-mini-label">Wezwanie · delivered Tue 27 Oct</span>
              <span className="lp-icon-btn lp-icon-btn-sm" aria-hidden="true"><Icon name="calendar" size={16} /></span>
            </div>
            <p className="lp-dl-big">Reply by 10 Nov</p>
            <p className="lp-dl-sub">14 days from delivery · counted in code</p>
            <ol className="lp-ticks" aria-hidden="true">
              {TICKS.map((t) => <li key={t} className={t === 14 ? "is-last" : undefined} style={{ "--i": t } as CSSProperties} />)}
            </ol>
            <div className="lp-ticks-legend" aria-hidden="true"><span>28 Oct · day 1</span><span>day 14</span></div>
          </div>
        </PhotoCard>
      </div>
    </section>
  );
}
