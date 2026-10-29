"use client";

import Link from "next/link";
import { useState } from "react";
import { api, friendlyError } from "@/lib/client/api";
import type { Plan, Product } from "@/lib/client/types";
import { PlanGrid } from "./PlanGrid";

const PLAN_NAME: Record<Plan["kind"], string> = { free: "Free", case_pass: "Case Pass", judge: "Judge access" };

export function Checkout() {
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const buy = async (product: Product) => {
    if (!consent) {
      setMsg({ text: "Tick the box above first: it confirms you want access to start straight away." });
      document.getElementById("consent")?.focus();
      return;
    }
    setBusy(product);
    setMsg(null);
    const r = await api.checkout(product, code.trim() || undefined);
    setBusy(null);
    if (!r.ok) return setMsg({ text: friendlyError(r) });
    window.location.assign(r.data.checkoutUrl);
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy("redeem");
    setMsg(null);
    const r = await api.redeem(code.trim());
    setBusy(null);
    if (!r.ok) return setMsg({ text: r.code === "invalid_code" || r.status === 400 || r.status === 404 ? "That code is not valid. You can still use it at checkout if it is a discount code." : friendlyError(r) });
    setMsg({ text: `Code applied: ${PLAN_NAME[r.data.plan.kind] ?? r.data.plan.kind}${r.data.plan.creditsLeft ? ` · ${r.data.plan.creditsLeft} credits` : ""}. Your case is unlocked.`, ok: true });
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "20px" }}>
      <form className="card code-form" onSubmit={redeem} aria-label="Redeem a code">
        <label className="field" style={{ flex: 1 }}>
          <span>Have a code?</span>
          <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" autoComplete="off" maxLength={40} />
        </label>
        <button className="btn" disabled={!code.trim() || busy !== null}>{busy === "redeem" ? "Checking…" : "Apply"}</button>
      </form>

      <label className="check card consent">
        <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>I want immediate access and understand I lose my 14-day withdrawal right once the service starts.</span>
      </label>

      {msg && <div className={msg.ok ? "notice notice-calm" : "error-box"} role="status">{msg.text}{msg.ok && <> <Link href="/app">Open my case →</Link></>}</div>}

      <PlanGrid
        action={(p) =>
          p === "free" ? (
            <Link className="btn btn-small" href="/app/letters">Read a letter</Link>
          ) : (
            <button className={`btn btn-small${p === "case_pass" ? " btn-primary" : ""}`} onClick={() => void buy(p as Product)} disabled={busy !== null} aria-disabled={!consent}>
              {busy === p ? "Opening checkout…" : "Buy"}
            </button>
          )
        }
      />
      <p className="small muted" style={{ margin: 0 }}>
        Prices in PLN. Payment, invoices and VAT are handled by our payment provider and merchant of record, Dodo Payments. A card is charged once; nothing renews.
      </p>
    </div>
  );
}
