import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PLANS } from "@/lib/client/plans";
import { PhotoCard } from "./Photo";

/** Pricing teaser: two tiers, the essentials, a link to the full page. */
export function PricingTeaser() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="price-h">
      <div className="lp-head lp-head-center" data-reveal>
        <span className="lp-kicker">Pricing</span>
        <h2 id="price-h">Start free. Pay once per case.</h2>
        <p>No subscription. One payment covers one residence case.</p>
      </div>
      <div className="lp-prices">
        {PLANS.map((p) => (
          <article key={p.product} className={`lp-price${p.featured ? " is-featured" : ""}`} data-reveal>
            <div className="lp-price-top">
              <h3>{p.name}</h3>
              {p.featured && <span className="lp-chip-ui lp-chip-inv">For the whole case</span>}
            </div>
            <p className="lp-price-n"><b>{p.price}</b> <span>{p.per}</span></p>
            <p className="lp-price-note">{p.note}</p>
            <ul>
              {p.points.slice(0, 3).map((x) => (
                <li key={x}><Icon name="check" size={16} />{x}</li>
              ))}
            </ul>
            <Link href={p.featured ? "/pricing" : "/signup"} className={`lp-btn ${p.featured ? "lp-btn-inv" : "lp-btn-dark"} lp-btn-block`}>
              {p.featured ? "See what Plus includes" : "Get started free"}
            </Link>
          </article>
        ))}
      </div>
      <p className="lp-center-link"><Link href="/pricing" className="lp-textlink">Compare plans and the family add-on <Icon name="arrow" size={16} /></Link></p>
    </section>
  );
}

/** Final call to action over the new-home photo. The site footer carries the one interpret-only line. */
export function FinalCta() {
  return (
    <section className="lp-section lp-wrap" aria-labelledby="final-h">
      <PhotoCard
        src="/landing/new-home.jpg"
        alt="Morning light in a newly rented apartment, boxes still half unpacked"
        tone="home"
        className="lp-final"
      >
        <div className="lp-final-body" data-reveal>
          <h2 id="final-h">Settle in. Your case is in good hands.</h2>
          <p>Try the whole journey on Arjun&apos;s sample case, or start your own in a minute.</p>
          <div className="lp-ctas">
            <Link className="lp-btn lp-btn-inv" href="/signup">
              Get started free <span className="lp-btn-ic" aria-hidden="true"><Icon name="arrow" size={18} /></span>
            </Link>
            <Link className="lp-btn lp-btn-glass" href="/signup?start=sample">See the sample case</Link>
          </div>
        </div>
      </PhotoCard>
    </section>
  );
}
