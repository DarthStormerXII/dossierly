import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

const POINTS: { icon: IconName; t: string; d: string }[] = [
  { icon: "shield", t: "One private agent per person", d: "Your agent runs in its own NVIDIA NemoClaw / OpenShell sandbox and keeps a masked memory of your case." },
  { icon: "lock", t: "A restricted network policy", d: "The published policy allows only the official sites, Tavily and the app. Everything else is denied." },
  { icon: "file", t: "A privacy ledger", d: "Every model call and every network call your agent made, hash-chained, from OpenShell's own audit log." },
  { icon: "case", t: "Encrypted on your device", d: "The case lives on your phone, encrypted with AES-GCM. With a passkey that supports PRF, the key comes from the passkey." },
];

const MASKS = [
  { real: "Arjun Raman", token: "[NAME_1]" },
  { real: "WSC-II-P.6151.48213.2026", token: "[CASE_1]" },
  { real: "ul. Grzybowska 12/4", token: "[ADDRESS_1]" },
];

const LEDGER = [
  { k: "Model", what: "Nemotron 3.5 Super VL · letter read", h: "9c1e" },
  { k: "Network", what: "migrant.wsc.mazowieckie.pl · allowed", h: "4a07" },
  { k: "Network", what: "api.tavily.com · allowed", h: "e25b" },
  { k: "Model", what: "Nemotron 3 Ultra · linked to 18 Sep", h: "71d3" },
];

/** Privacy section: honest wording, with the receipts drawn as UI. */
export function Privacy() {
  return (
    <section className="lp-section lp-wrap" id="privacy" aria-labelledby="privacy-h">
      <div className="lp-priv">
        <div className="lp-priv-copy" data-reveal>
          <span className="lp-kicker">Private by design, verifiable</span>
          <h2 id="privacy-h">We don&apos;t ask you to trust us. We show you the receipts.</h2>
          <p className="lp-priv-lede">
            Your personal identifiers are masked before any model call and restored in the answer. Your agent still
            sees the masked case as plain text while it works, and we say so.
          </p>
          <ul className="lp-priv-list">
            {POINTS.map((p) => (
              <li key={p.t}>
                <span className="lp-icon-btn" aria-hidden="true"><Icon name={p.icon} size={20} /></span>
                <div><b>{p.t}</b><span>{p.d}</span></div>
              </li>
            ))}
          </ul>
          <Link href="/limits" className="lp-textlink">Read the published limitations <Icon name="arrow" size={16} /></Link>
        </div>

        <div className="lp-priv-visual" data-reveal>
          <div className="lp-mock lp-mask" aria-label="Identifiers masked before any model call">
            <span className="lp-mini-label">Before any model call</span>
            <ul>
              {MASKS.map((m) => (
                <li key={m.token}>
                  <s>{m.real}</s>
                  <Icon name="arrow" size={14} />
                  <code>{m.token}</code>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-mock lp-ledger" aria-label="Privacy ledger excerpt">
            <div className="lp-mock-head">
              <span className="lp-mini-label">Privacy ledger · sample</span>
              <span className="lp-pill-sm lp-pill-ok"><Icon name="check" size={12} /> Chain intact</span>
            </div>
            <ol>
              {LEDGER.map((l) => (
                <li key={l.h}>
                  <span className={`lp-ledger-k${l.k === "Model" ? " is-model" : ""}`}>{l.k}</span>
                  <span className="lp-ledger-what">{l.what}</span>
                  <code className="lp-ledger-h">#{l.h}</code>
                </li>
              ))}
            </ol>
          </div>

          <div className="lp-mock lp-policy" aria-label="Network policy summary">
            <span className="lp-mini-label">Network policy · dossierly-restricted</span>
            <div className="lp-policy-rows">
              <span className="lp-chip-ui lp-chip-allow">Official sites</span>
              <span className="lp-chip-ui lp-chip-allow">Tavily</span>
              <span className="lp-chip-ui lp-chip-allow">The app</span>
              <span className="lp-chip-ui lp-chip-deny">Everything else · denied</span>
            </div>
            <code className="lp-sha">sha256 2f140afa…f6ff70</code>
          </div>
        </div>
      </div>
    </section>
  );
}
