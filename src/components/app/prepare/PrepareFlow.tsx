"use client";

import { useEffect, useRef, useState } from "react";
import { api, pollTask, type ApiFailure } from "@/lib/client/api";
import { todayIso } from "@/lib/client/format";
import { OFFICES } from "@/lib/client/sample";
import { useDossier } from "@/lib/client/store";
import type { AgentTask, HubChange, PrepareResult } from "@/lib/client/types";
import { ErrorNote } from "../../States";
import { AgentTrace } from "./AgentTrace";
import { PrepareResultView } from "./PrepareResultView";

const PURPOSES = [
  "Hand in missing documents after a wezwanie",
  "Fingerprints (odciski palców)",
  "Collect the residence card (odbiór karty)",
  "Ask about the status of my case",
];

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PrepareFlow() {
  const d = useDossier();
  const [office, setOffice] = useState(OFFICES.includes(d.case.office) ? d.case.office : OFFICES[0]);
  const [purpose, setPurpose] = useState(d.letters.length ? PURPOSES[0] : PURPOSES[1]);
  const [date, setDate] = useState(d.nextAppointment?.date ?? plusDays(4));
  const [task, setTask] = useState<AgentTask<PrepareResult> | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [err, setErr] = useState<ApiFailure | string | null>(null);
  const [changes, setChanges] = useState<HubChange[]>([]);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    void api.hubChanges().then((r) => r.ok && setChanges(r.data.changes));
    return () => ctl.current?.abort();
  }, []);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setErr(null);
    setTask(null);
    setStarted(Date.now());
    const r = await api.prepare(d.case, { office, purpose, date });
    if (!r.ok) {
      setStarted(null);
      return setErr(r);
    }
    const done = await pollTask<PrepareResult>(r.data.taskId, setTask, c.signal);
    setStarted(null);
    if (!done.ok) return setErr(done);
    if (done.data.status === "failed") return setErr(done.data.error ?? "The agent could not finish this checklist.");
    d.logRuns("prepare", [done.data.run]);
  };

  const busy = started !== null;
  const result = task?.status === "done" ? task.result : undefined;

  return (
    <div className="page page-wide stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">Before · prepare</span>
        <h1 className="page-title">Prepare for an appointment</h1>
        <p className="muted" style={{ margin: 0 }}>Your private agent reads the official pages for your office, checks them against your case and writes a checklist. Every line cites the paragraph it came from.</p>
      </div>

      <form className="card stack prep-form" onSubmit={(e) => void run(e)} style={{ ["--gap" as string]: "14px" }}>
        <label className="field">
          <span>Office</span>
          <select className="input" value={office} onChange={(e) => setOffice(e.target.value)}>
            {OFFICES.map((o) => <option key={o} value={o}>{o.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki · ")}</option>)}
          </select>
        </label>
        <label className="field">
          <span>What is the appointment for?</span>
          <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input className="input mono" type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} required style={{ maxWidth: 220 }} />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Your agent is working…" : result ? "Prepare again" : "Prepare my checklist"}</button>
      </form>

      {(busy || task) && <AgentTrace task={task} startedAt={started} />}
      {err && <ErrorNote failure={err} onRetry={() => void run()} />}
      {result && task && (
        <PrepareResultView
          result={result}
          task={task}
          hubChanges={changes}
          appointment={{ office, purpose, date }}
        />
      )}
    </div>
  );
}
