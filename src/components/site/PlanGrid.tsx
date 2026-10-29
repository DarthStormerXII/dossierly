import Link from "next/link";
import { PLANS } from "@/lib/client/plans";

/** Static plan cards for the landing page; the pricing page adds the checkout controls. */
export function PlanGrid({ action }: { action?: (product: string) => React.ReactNode }) {
  return (
    <div className="plan-grid">
      {PLANS.map((p) => (
        <article key={p.product} className={`plan${p.featured ? " is-featured" : ""}`} aria-label={p.name}>
          <div className="row between">
            <h3 style={{ margin: 0 }}>{p.name}</h3>
            {p.featured && <span className="chip chip-official">Most cases</span>}
          </div>
          <p className="plan-price mono">{p.price}</p>
          <p className="tiny muted" style={{ marginTop: -4 }}>{p.note}</p>
          <ul className="plan-points small">{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
          {action ? action(p.product) : (
            <Link className={`btn btn-small${p.featured ? " btn-primary" : ""}`} href={p.product === "free" ? "/app" : "/pricing"}>
              {p.product === "free" ? "Read a letter" : "Choose"}
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}

export function PricingSection() {
  return (
    <section className="section wrap" aria-labelledby="price-h">
      <div className="section-head">
        <span className="kicker">Pricing</span>
        <h2 id="price-h">Pay once for the case, not every month.</h2>
        <p>Prices in PLN. VAT is handled by our payment provider, Dodo Payments.</p>
      </div>
      <PlanGrid />
    </section>
  );
}
