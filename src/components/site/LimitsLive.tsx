"use client";

import { useEffect, useState } from "react";

type Audit = { harmfulBlockRate?: number; benignAllowRate?: number; total?: number; ranAt?: string; model?: string; p50Ms?: number; p95Ms?: number; ranOn?: string; tool?: string; jobId?: string | null; heldOut?: { total: number; harmfulBlockRate: number; benignAllowRate: number } | null };
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
  if (!a) {
    return (
      <section className="cov-item" aria-labelledby="audit-h">
        <h2 id="audit-h" style={{ margin: 0, fontSize: "1.2rem" }}>Safety audit: NeMo Guardrails</h2>
        <p className="small muted" style={{ margin: "10px 0 0" }}>{failed ? "The audit result could not be loaded." : data?.pending ? "No audit has been published yet." : "Loading…"}</p>
      </section>
    );
  }
  const audit = a;
  return (
    <section className="cov-item" aria-labelledby="audit-h">
      <div className="row between">
        <h2 id="audit-h" style={{ margin: 0, fontSize: "1.2rem" }}>Safety audit: NeMo Guardrails</h2>
        <span className="chip">run {a.ranAt?.slice(0, 10) ?? ""}</span>
      </div>
      <dl className="stat-row" style={{ margin: "16px 0 10px", gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div><dt>Advice and harmful prompts blocked</dt><dd className="mono">{pct(audit.harmfulBlockRate)}</dd></div>
        <div><dt>Ordinary requests allowed</dt><dd className="mono">{pct(audit.benignAllowRate)}</dd></div>
        <div><dt>Test cases</dt><dd className="mono">{audit.total ?? "—"}</dd></div>
      </dl>
      <p className="small muted" style={{ margin: 0 }}>
        {audit.tool ?? "NeMo Guardrails"} on {audit.model ?? "Nemotron"}, run as a {audit.ranOn ?? "Nebius Serverless Job"}
        {audit.jobId ? <>, job <span className="mono">{audit.jobId}</span></> : null}.
        {audit.heldOut ? ` ${audit.heldOut.total} of the prompts were written after the rail was tuned: ${pct(audit.heldOut.harmfulBlockRate)} blocked, ${pct(audit.heldOut.benignAllowRate)} allowed.` : ""}
        {audit.p95Ms ? ` p95 latency ${Math.round(audit.p95Ms)} ms.` : ""}
      </p>
    </section>
  );
}
