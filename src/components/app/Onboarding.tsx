"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGE_NAMES, OFFICES } from "@/lib/client/sample";
import { useCase } from "@/lib/client/store";
import type { Language } from "@/lib/client/types";

export function Onboarding() {
  const { startSample, startOwn } = useCase();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [office, setOffice] = useState(OFFICES[0]);
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("start");
    if (p === "sample" && !auto.current) {
      auto.current = true;
      void startSample();
    }
  }, [startSample]);

  const own = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await startOwn(name.trim(), language, office);
  };

  return (
    <div className="onboard">
      <div className="stack">
        <span className="tab-label">New case · Poland</span>
        <h1>Open a case file</h1>
        <p className="muted lead">Your case lives on this device, encrypted. Your private agent keeps a masked copy in its own sandbox so it can remember, and our servers keep a ledger of every call it makes.</p>
      </div>

      <section className="card sample-card stack" aria-labelledby="sample-h">
        <div className="row between">
          <h2 id="sample-h" style={{ margin: 0 }}>Arjun&apos;s case</h2>
          <span className="stamp">SAMPLE</span>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Fictional person, real procedure. Try every feature before using your own details.</p>
        <dl className="facts">
          <div><dt>Applicant</dt><dd>Arjun Raman</dd></div>
          <div><dt>Permit</dt><dd>Temporary residence and work</dd></div>
          <div><dt>Office</dt><dd>Mazowiecki, Marszałkowska 3/5</dd></div>
          <div><dt>Case signature</dt><dd className="mono">WSC-II-P.6151.48213.2026</dd></div>
          <div><dt>So far</dt><dd>Applied via MOS on 2 Jun · fingerprints 18 Sep, where the official said health insurance proof is missing and a letter will follow</dd></div>
        </dl>
        <button className="btn btn-primary btn-block" onClick={() => void startSample()}>Open the sample case</button>
      </section>

      <form className="card stack" onSubmit={own} aria-labelledby="own-h">
        <h2 id="own-h" style={{ margin: 0 }}>Start my own case</h2>
        <label className="field">
          <span>Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="As written in your passport" />
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 6 }}>Your language</legend>
          <div className="seg">
            {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
              <label key={l}>
                <input type="radio" name="lang" value={l} checked={language === l} onChange={() => setLanguage(l)} />
                <span>{LANGUAGE_NAMES[l].native}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Your office</span>
          <select className="input" value={office} onChange={(e) => setOffice(e.target.value)}>
            {OFFICES.map((o) => <option key={o} value={o}>{o.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki · ")}</option>)}
          </select>
        </label>
        <p className="tiny muted" style={{ margin: 0 }}>Poland only for now: temporary residence and work in the Mazowieckie voivodeship. Germany and France are next.</p>
        <button className="btn btn-block" disabled={busy || !name.trim()}>Create my case</button>
      </form>
    </div>
  );
}
