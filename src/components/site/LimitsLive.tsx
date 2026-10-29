"use client";

import { useEffect, useState } from "react";

type Audit = { harmfulBlockRate?: number; benignAllowRate?: number; total?: number; ranAt?: string; model?: string; p50Ms?: number; p95Ms?: number; region?: string };
type Limits = { pending: boolean; audit?: Audit; eval?: Record<string, unknown>; updatedAt?: string };

const pct = (n?: number) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");

/** The latest NeMo Guardrails audit published by the Nebius Serverless Job, with the caveat it needs. */
export function LimitsLive() {
  const [data, setData] = useState<Limits | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/limits")
      .then((r) => (r.ok ? (r.json() as Promise<Limits>) : Promise.reject(new Error("limits"))))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const a = data?.audit;
  const audit = a ?? { harmfulBlockRate: 0.933, benignAllowRate: 1, total: 23 };
  return (
    <section className="cov-item" aria-labelledby="audit-h">
      <div className="row between">
        <h2 id="audit-h" style={{ margin: 0, fontSize: "1.2rem" }}>Safety audit: NeMo Guardrails</h2>
        <span className="chip">{a ? `run ${a.ranAt?.slice(0, 10) ?? ""}` : data?.pending || failed ? "last published result" : "loading…"}</span>
      </div>
      <dl className="stat-row" style={{ margin: "16px 0 10px", gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div><dt>Advice and harmful prompts blocked</dt><dd className="mono">{pct(audit.harmfulBlockRate)}</dd></div>
        <div><dt>Ordinary requests allowed</dt><dd className="mono">{pct(audit.benignAllowRate)}</dd></div>
        <div><dt>Test cases</dt><dd className="mono">{audit.total ?? "—"}</dd></div>
      </dl>
      <p className="small muted" style={{ margin: 0 }}>
        Indicative only: the rails were tuned on the same small set they were tested on, so expect lower numbers on new prompts. Run as a Nebius Serverless Job{a?.region ? ` in ${a.region}` : ""}.
        {a?.p95Ms ? ` p95 latency ${Math.round(a.p95Ms)} ms.` : ""}
      </p>
    </section>
  );
}
