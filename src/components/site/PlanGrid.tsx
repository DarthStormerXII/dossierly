import Link from "next/link";
import { FAMILY_ADDON, PLANS } from "@/lib/client/plans";
import { Icon } from "../Icon";

/** The two tiers. Public pages link to sign-up; the in-app plan step passes its own actions. */
export function PlanGrid({ action }: { action?: (product: string) => React.ReactNode }) {
  return (
    <div className="plan-grid">
      {PLANS.map((p) => (
        <article key={p.product} className={`plan${p.featured ? " is-featured" : ""}`} aria-label={p.name}>
          <div className="plan-top">
            <h3 className="plan-name">{p.name}</h3>
            {p.featured && <span className="plan-badge">Most cases</span>}
          </div>
          <p className="plan-price"><span>{p.price}</span> <small>{p.per}</small></p>
          <p className="plan-note">{p.note}</p>
          <ul className="plan-points">
            {p.points.map((x) => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}
          </ul>
          <div className="plan-cta">
            {action ? action(p.product) : (
              <Link className={`btn btn-block${p.featured ? " btn-primary" : ""}`} href={p.product === "free" ? "/signup" : "/signup?plan=plus"}>
                {p.product === "free" ? "Get started free" : "Get Dossierly Plus"}
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function FamilyAddon() {
  return (
    <div className="addon">
      <div>
        <b>{FAMILY_ADDON.name}</b> <span className="addon-price">{FAMILY_ADDON.price}</span>
        <p className="small muted" style={{ margin: "4px 0 0" }}>{FAMILY_ADDON.note}</p>
      </div>
      <span className="chip">With Plus</span>
    </div>
  );
}

export function PricingSection() {
  return (
    <section className="section wrap" aria-labelledby="price-h">
      <div className="section-head">
        <span className="kicker">Pricing</span>
        <h2 id="price-h">Start free. Pay once per case.</h2>
      </div>
      <PlanGrid />
    </section>
  );
}
