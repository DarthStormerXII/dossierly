import Link from "next/link";
import { Icon } from "@/components/Icon";

const NEXT = [
  { name: "Germany", local: "Deutschland" },
  { name: "France", local: "France" },
];

/** Countries: Poland live, the next two named, the rule for adding more. */
export function Countries() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="countries-h">
      <div className="lp-head lp-head-row" data-reveal>
        <div>
          <span className="lp-kicker">Countries</span>
          <h2 id="countries-h">Poland first. Countries enabled one by one.</h2>
        </div>
        <p>A country goes live only when its offices, letter types and deadline rules are covered from their sources.</p>
      </div>
      <div className="lp-countries">
        <Link href="/countries" className="lp-country lp-country-live" data-reveal>
          <div className="lp-country-top">
            <span className="lp-chip-ui lp-chip-inv"><span className="lp-live" aria-hidden="true" />Live</span>
            <span className="lp-icon-btn lp-icon-btn-light" aria-hidden="true"><Icon name="arrow" size={18} /></span>
          </div>
          <div>
            <span className="lp-country-local" lang="pl">Polska</span>
            <b className="lp-country-name">Poland</b>
            <span className="lp-country-sub">Temporary residence and work · Mazowieckie voivodeship, Warsaw</span>
          </div>
        </Link>
        {NEXT.map((c) => (
          <div key={c.name} className="lp-country" data-reveal>
            <div className="lp-country-top">
              <span className="lp-chip-ui">Next</span>
            </div>
            <div>
              <span className="lp-country-local">{c.local}</span>
              <b className="lp-country-name">{c.name}</b>
              <span className="lp-country-sub">Same caseworker, new office playbooks and deadline rules. Not available yet.</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
