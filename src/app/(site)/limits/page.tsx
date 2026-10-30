import type { Metadata } from "next";
import { LimitsLive } from "@/components/site/LimitsLive";

export const metadata: Metadata = { title: "Limitations", description: "What Dossierly cannot do, and where its privacy and accuracy end." };

const KNOWN = [
  { t: "Lightning is weak outside English", d: "In our tests Nemotron 3.5 Lightning garbled Hindi, Tamil and Ukrainian. Those languages are routed to Nemotron 3.5 Super VL, which is slightly slower." },
  { t: "No fixed region for model calls", d: "Public Nebius Token Factory endpoints do not pin a region. Calls are sent with storage off and Nebius does not train on them; Zero Data Retention is switched on at production launch." },
  { t: "Your agent sees plain text while it works", d: "Names, case numbers, PESEL and addresses are masked first, but the rest of the case is readable by your agent during a task." },
  { t: "The ledger is our own record", d: "We write the ledger and hash-chain it so changes are detectable. The sandbox's own network log (OpenShell) is collected on a best-effort basis and may miss entries." },
  { t: "Limited local capacity", d: "Until our first 10–20 users, personal agents run on our own hardware, which handles about 4 to 6 agents at once. When it is busy, tasks run on the cloud fallback and are labelled that way." },
  { t: "Speech is transcribed by NVIDIA Parakeet", d: "In Polish, English and Ukrainian, each spoken turn is sent once to our private-agent host, transcribed by NVIDIA Parakeet, then deleted: no audio is stored. Hindi and Tamil use your browser's own recognition, and the spoken Polish voice is your browser's. Typing always works." },
  { t: "Deadlines need the right delivery date", d: "We count from the date you give us, using the rules quoted on the Poland page. The date written in your letter always wins. Check it." },
  { t: "Not legal or medical advice", d: "Dossierly interprets and explains. For advice, find a qualified lawyer (rejestradwokatow.pl) or a doctor." },
];

export default function LimitsPage() {
  return (
    <div className="doc-page">
      <span className="kicker">Published limitations</span>
      <h1>What Dossierly cannot do</h1>
      <p className="lead muted">We publish the limits we know about, with numbers where we have them.</p>
      <div className="stack" style={{ marginTop: 24 }}>
        <LimitsLive />
        <ul className="cov-list">
          {KNOWN.map((k) => (
            <li key={k.t} className="cov-item">
              <b>{k.t}</b>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{k.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
