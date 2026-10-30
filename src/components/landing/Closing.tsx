import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PLANS } from "@/lib/client/plans";

/** Pricing teaser: the two tiers as quiet cards, a link to the full page. */
export function PricingTeaser() {
  return (
    <section className="lp-sec" aria-labelledby="price-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <h2 id="price-h" className="lp-h2" data-sweep>Start free. Pay once per case.</h2>
          <p className="lp-body">No subscription. One payment covers one residence case for 18 months.</p>
        </header>
        <div className="lp-prices">
          {PLANS.map((p) => (
            <article key={p.product} className={`lp-price${p.featured ? " is-featured" : ""}`} data-reveal>
              <div className="lp-price-top">
                <h3>{p.name}</h3>
                {p.featured && <span className="lp-tag lp-tag-dark">For the whole case</span>}
              </div>
              <p className="lp-price-n"><b>{p.price}</b> <span>{p.per}</span></p>
              <p className="lp-price-note">{p.note}</p>
              <ul>
                {p.points.slice(0, 4).map((x) => <li key={x}><Icon name="check" size={15} />{x}</li>)}
              </ul>
              <Link href={p.featured ? "/signup?plan=plus" : "/signup"} className={`lp-btn ${p.featured ? "lp-btn-dark" : "lp-btn-soft"} lp-btn-block`}>
                {p.featured ? "Get Dossierly Plus" : "Get started free"}
              </Link>
            </article>
          ))}
        </div>
        <p className="lp-center"><Link href="/pricing" className="lp-ulink">Compare plans and the family add-on</Link></p>
      </div>
    </section>
  );
}

/** "Don't take our word for it": the sample case, live. */
export function FinalCta() {
  return (
    <section className="lp-sec" aria-labelledby="final-h">
      <div className="lp-wrap lp-final">
        <div>
          <p className="lp-mono">Sample case</p>
          <h2 id="final-h" className="lp-h2 lp-final-h"><span className="lp-h2-muted">Don&apos;t take our word for it.</span>Open Arjun&apos;s case now.</h2>
          <p className="lp-body">
            Arjun Raman is a fictional applicant. His office, his letter type and his deadline rules are real. Read his
            letter, count his deadline and try table mode.
          </p>
          <p className="lp-grad" aria-label="Reply by 10 November">Reply by 10 Nov</p>
          <div className="lp-hero-ctas lp-ctas-l">
            <Link className="lp-btn lp-btn-dark" href="/signup?start=sample"><Icon name="case" size={16} /> Open the sample</Link>
            <Link className="lp-btn lp-btn-line" href="/signup">Get started</Link>
          </div>
        </div>
        <div className="lp-final-panel" data-reveal>
          <div className="lp-final-card">
            <div className="lp-final-top"><span className="lp-mono">Interpreting</span><span>Mazowiecki office</span></div>
            <div className="lp-ph-bubble lp-ph-off" lang="pl">„Proszę podać numer sprawy.”</div>
            <div className="lp-ph-bubble lp-ph-me">Please give your case number.</div>
            <div className="lp-ph-bubble lp-ph-off lp-ph-fade" lang="pl">„Przyjdzie pismo w tej sprawie.”</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "What exactly is Dossierly?", a: "A personal AI caseworker for life abroad. You get your own private agent that remembers your whole residence case: it prepares you for official appointments, interprets while you talk to the official, reads the letters that follow and counts the deadlines." },
  { q: "Is this legal advice?", a: "No. Dossierly interprets and explains. It never gives legal or medical advice, and an interpret-only guard checks every turn." },
  { q: "Which countries and offices are covered?", a: "Poland first: temporary residence and work at the Mazowiecki office in Warsaw. Germany and France are next. A country goes live only when its offices, letter types and deadline rules are covered from their sources." },
  { q: "Which languages can I use?", a: "The official's side is Polish. You can speak English, Ukrainian, Hindi or Tamil. Interface labels are in English; content follows your language." },
  { q: "Does Dossierly hear my audio?", a: "No. Speech recognition and the Polish voice are your browser's own (Chrome sends speech to Google to transcribe it). Dossierly receives text, never audio." },
  { q: "What happens to my personal data?", a: "Your case lives on your device, encrypted with AES-GCM. Identifiers are masked before any model call, every model call and connection is listed in your privacy ledger, and Nebius does not train on customer data." },
  { q: "What does it cost?", a: "Free to start: three official letters, appointment preparation, interpreting and deadlines. Dossierly Plus is $39 once per case, for one residence case over 18 months. Nothing renews." },
];

/** "Your questions, covered": heading and button on the left, an accordion on the right. */
export function Faq() {
  return (
    <section className="lp-sec" aria-labelledby="faq-h">
      <div className="lp-wrap lp-faq">
        <div>
          <h2 id="faq-h" className="lp-h2">Your questions, covered<span className="lp-h2-muted">Get started today</span></h2>
          <Link className="lp-btn lp-btn-dark lp-btn-lg" href="/signup">Get started</Link>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((f, i) => (
            <details key={f.q} className="lp-faq-item" open={i === 0}>
              <summary>{f.q}<span className="lp-faq-ic" aria-hidden="true" /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
