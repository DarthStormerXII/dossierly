import type { Metadata } from "next";
import Link from "next/link";
import { FamilyAddon, PlanGrid } from "@/components/site/PlanGrid";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free with three letters, appointment preparation and live interpreting. Dossierly Plus is $39 once for one residence case.",
};

const COMPARE: { row: string; free: string; plus: string }[] = [
  { row: "Official letters read, explained and linked to your case", free: "3", plus: "Unlimited" },
  { row: "Polish reply drafted for a letter", free: "Yes", plus: "Yes" },
  { row: "Appointment preparation with cited checklists", free: "Yes", plus: "Yes" },
  { row: "Live two-way interpreting and the watcher", free: "Yes", plus: "Yes" },
  { row: "Wrap-up after each visit", free: "Yes", plus: "Yes" },
  { row: "Deadlines counted, every step shown", free: "Yes", plus: "Yes" },
  { row: "Your own private agent in its own sandbox", free: "Yes", plus: "Yes" },
  { row: "Privacy ledger", free: "Yes", plus: "Yes" },
  { row: "Family add-on (+$15)", free: "No", plus: "Available" },
  { row: "Price", free: "$0", plus: "$39 once per case" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "What counts as usage?", a: "Only letters are counted: each official letter Dossierly reads successfully uses one of your three free letters. Preparing, interpreting, wrap-ups and deadlines are not counted." },
  { q: "What happens at the limit?", a: "After the third letter, the next one asks you to choose Plus. Everything else keeps working, and your case and deadlines stay on your device." },
  { q: "How do I switch plans?", a: "Open Plan at the bottom of the app, or follow the prompt on the Letters page. Plus starts as soon as the payment goes through." },
  { q: "Why once per case, not monthly?", a: "A residence case runs about a year and a half from application to decision. You pay once when you need more than the free tier, and nothing renews." },
  { q: "What counts as a letter?", a: "Any official letter you photograph or upload that Dossierly can read. A blurry photo it cannot read does not count." },
  { q: "Can I pay with BLIK or Przelewy24?", a: "Yes. Dodo Payments, our merchant of record, shows local methods and your currency at checkout and handles invoices and VAT." },
  { q: "Where does my case live?", a: "On your device, encrypted. Your private agent keeps a masked copy in its own sandbox. Paying changes none of that." },
  { q: "Who handles payment?", a: "Dodo Payments, our merchant of record: payment, invoices, VAT and refunds." },
  { q: "I'm judging the hackathon.", a: "Sign up, then on the plan step enter DOSSIERLYJUDGES under Have a code? and continue to Plus: the checkout total is $0." },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="pricing-page">
      <div className="wrap">
        <header className="pricing-head">
          <span className="kicker">Pricing</span>
          <h1>Start free. Pay once per case.</h1>
          <p className="lead muted">Everything you need for your next appointment is free. When the letters start arriving, Plus covers the whole case.</p>
        </header>
        {reason === "letters" && (
          <div className="notice notice-calm pricing-notice">
            Your three free letters are used. Plus reads every letter for the rest of your case. Your case and its deadlines stay on your device either way.
          </div>
        )}
        <PlanGrid />
        <div className="pricing-under">
          <FamilyAddon />
          <p className="small muted">Prices in US dollars; you see your own currency at checkout. Payment, invoices and VAT are handled by Dodo Payments.</p>
        </div>
        <section className="compare" aria-labelledby="cmp-h">
          <h2 id="cmp-h">Compare plans</h2>
          <div className="compare-scroll">
            <table className="compare-table">
              <thead><tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col">Free</th><th scope="col">Dossierly Plus</th></tr></thead>
              <tbody>
                {COMPARE.map((c) => (
                  <tr key={c.row}><th scope="row">{c.row}</th><td>{c.free}</td><td>{c.plus}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="faq" aria-labelledby="faq-h">
          <h2 id="faq-h">Questions</h2>
          <div className="faq-list">
            {FAQ.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <div className="pricing-final">
          <h2>Your next appointment, prepared.</h2>
          <Link className="btn btn-primary" href="/signup">Get started free</Link>
        </div>
      </div>
    </div>
  );
}
