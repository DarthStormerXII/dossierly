"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCase } from "@/lib/client/store";
import { Icon, type IconName } from "../../Icon";

type Audit = { tool: string; model: string; ranOn: string; ranAt: string; total: number; harmfulBlockRate: number; benignAllowRate: number; p50Ms: number };

const STEPS: { icon: IconName; title: string; body: string; href: string }[] = [
  { icon: "prepare", title: "Prepare", body: "Before an appointment, your agent reads today's official pages and builds a checklist where every line cites its paragraph.", href: "/app/prepare" },
  { icon: "meet", title: "Meet", body: "At the counter, lay the phone flat. Each side reads in their own language, and a watcher flags dates, amounts and documents.", href: "/app/meet" },
  { icon: "calendar", title: "Wrap-up", body: "After the visit: what was agreed, what to bring and which dates were named, filed into your case.", href: "/app/meet" },
  { icon: "letter", title: "Letters", body: "Photograph a letter or upload the PDF. You see the Polish beside the explanation, the link to earlier visits and the deadline, counted step by step.", href: "/app/letters" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Where is my case stored?", a: "On this device, encrypted. Your private agent keeps a masked copy in its own sandbox so it can remember. Names and case numbers are masked before any model call." },
  { q: "Can I open my case on another device?", a: "Your passkey signs you in anywhere, but the case itself stays on the device where you made it. The sample case is available everywhere." },
  { q: "What if my agent is offline?", a: "The same step runs in the cloud instead, after 20 seconds, and the screen says so." },
  { q: "How do I delete everything?", a: "Privacy ledger, then Delete everything. It removes the case from this device and clears your agent's memory." },
  { q: "Who can I write to?", a: "darthstormer.ai@gmail.com. Dossierly is operated by Gokul Nath." },
];

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function HelpPage() {
  const { status } = useCase();
  const [audit, setAudit] = useState<Audit | null>(null);
  useEffect(() => {
    void fetch("/api/limits").then((r) => r.json()).then((d: { audit?: Audit }) => setAudit(d.audit ?? null)).catch(() => setAudit(null));
  }, []);
  const online = status?.bridge.online;

  return (
    <div className="page page-wide help">
      <span className="tab-label">Learn</span>
      <h1 className="page-title">How Dossierly works</h1>
      <p className="muted lead">One private agent per person, with you before, during and after every visit.</p>

      <div className="help-steps">
        {STEPS.map((s) => (
          <Link key={s.title} href={s.href} className="help-step">
            <span className="help-ic"><Icon name={s.icon} size={20} /></span>
            <b>{s.title}</b>
            <span>{s.body}</span>
          </Link>
        ))}
      </div>

      <div className="help-grid">
        <section className="card help-card" aria-labelledby="agent-h">
          <span className="tab-label">Your agent</span>
          <h2 id="agent-h" className="h-card">{online === undefined ? "Checking…" : online ? "Private agent online" : "Running in the cloud for now"}</h2>
          <p className="muted small">
            Every person gets an NVIDIA NemoClaw sandbox on OpenShell with a restricted network policy, running Nemotron 3.5 Super VL on Nebius Token Factory.
            {online && status && status.bridge.sandboxes > 0 && <> {status.bridge.sandboxes} sandboxes are running now.</>}
          </p>
          <Link className="btn btn-small" href="/app/privacy">See every call it made</Link>
        </section>

        <section className="card help-card" aria-labelledby="guard-h">
          <span className="tab-label">Interpret-only guard</span>
          <h2 id="guard-h" className="h-card">It interprets and explains. It never advises.</h2>
          {audit ? (
            <>
              <div className="help-stats">
                <div><b>{pct(audit.harmfulBlockRate)}</b><span>advice and harmful requests blocked</span></div>
                <div><b>{pct(audit.benignAllowRate)}</b><span>ordinary requests allowed</span></div>
              </div>
              <p className="muted small">
                Audited with {audit.tool} on a {audit.ranOn}, {audit.total} test prompts, {new Date(audit.ranAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Indicative: the rail was tuned on the same set.
              </p>
            </>
          ) : (
            <p className="muted small">Every turn passes a Nemotron 3.5 Lightning guard that refuses legal or medical advice. The NeMo Guardrails audit result appears here once published.</p>
          )}
          <p className="muted small" style={{ margin: 0 }}>For advice about your case, find a lawyer in the Polish bar register, rejestradwokatow.pl.</p>
        </section>
      </div>

      <section className="help-faq" aria-labelledby="faq-h">
        <h2 id="faq-h">Help</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="faq-item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <p className="small muted">
        <Link href="/limits">What we cannot promise yet</Link> · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy notice</Link>
      </p>
    </div>
  );
}
