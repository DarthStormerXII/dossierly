import { Icon, type IconName } from "@/components/Icon";

const PARTS: { icon: IconName; name: string; desc: string }[] = [
  { icon: "speak", name: "Nemotron 3.5 Lightning", desc: "Interpreted turns and the interpret-only guard" },
  { icon: "camera", name: "Nemotron 3.5 Super VL", desc: "Your agent, letter reading and the watcher" },
  { icon: "link", name: "Nemotron 3 Ultra", desc: "Links each new letter to the whole case" },
  { icon: "case", name: "Nebius Token Factory", desc: "Every model call, with store set to false" },
  { icon: "shield", name: "NVIDIA NemoClaw + OpenShell", desc: "One sandbox per person, audited network" },
  { icon: "check", name: "NeMo Guardrails", desc: "Audits the interpret-only rule as a Nebius job" },
  { icon: "prepare", name: "Nemotron embeddings", desc: "Rank official passages for every citation" },
  { icon: "external", name: "Tavily", desc: "Reads official Polish pages, and watches them" },
  { icon: "lock", name: "Dodo Payments", desc: "Checkout with BLIK, Przelewy24 and cards" },
];

const LOGOS: { file: string; name: string; role: string; h: number }[] = [
  { file: "nebius", name: "Nebius", role: "Token Factory · Nemotron inference", h: 26 },
  { file: "nvidia", name: "NVIDIA", role: "Nemotron · NemoClaw · OpenShell · Guardrails", h: 22 },
  { file: "tavily", name: "Tavily", role: "Official pages, read and watched", h: 22 },
  { file: "langchain", name: "LangChain", role: "Deep Agents inside each sandbox", h: 20 },
  { file: "dodo", name: "Dodo Payments", role: "Checkout and merchant of record", h: 24 },
  { file: "cloudflare", name: "Cloudflare", role: "App hosting in the EU", h: 24 },
];

/** "And it's all one system": every part, what it does in the product. */
export function BuiltOn() {
  return (
    <section className="lp-sec" aria-labelledby="built-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="built-h" className="lp-h2" data-sweep>And it&apos;s all one system</h2>
          <p className="lp-body">
            Nemotron models on Nebius Token Factory, each in the job it fits, inside one private agent per person. No
            stitched-together apps.
          </p>
        </header>
        <ul className="lp-logos" aria-label="Built with">
          {LOGOS.map((l) => (
            <li key={l.file}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/logos/${l.file}.svg`} alt={l.name} style={{ height: l.h }} />
              <span>{l.role}</span>
            </li>
          ))}
        </ul>
        <ul className="lp-parts">
          {PARTS.map((p) => (
            <li key={p.name}>
              <Icon name={p.icon} size={18} />
              <div><b>{p.name}</b><span>{p.desc}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
