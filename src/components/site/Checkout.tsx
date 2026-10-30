"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, choosePlan, friendlyError } from "@/lib/client/api";
import { useCase } from "@/lib/client/store";
import type { Product } from "@/lib/client/types";
import { FamilyAddon, PlanGrid } from "./PlanGrid";

/** The one-time plan step after onboarding: Free goes straight into the case, Plus opens Dodo checkout. */
export function Checkout({ suggest }: { suggest?: "plus" }) {
  const router = useRouter();
  const { refreshMe } = useCase();
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [discount, setDiscount] = useState<string | null>(null);

  const free = async () => {
    setBusy("free");
    const r = await choosePlan("free");
    setBusy(null);
    if (!r.ok) return setMsg({ text: friendlyError(r) });
    await refreshMe();
    router.replace("/app");
  };

  const buy = async (product: Product) => {
    if (!consent) {
      setMsg({ text: "Tick the box below the plans first: it confirms you want access to start straight away." });
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
    if (!r.ok && (r.code === "invalid_code" || r.status === 404)) {
      // Not an in-app access code: keep it as a discount code for the Dodo checkout.
      setDiscount(code.trim());
      return setMsg({ text: `Code ${code.trim()} saved. It is applied when you continue to Plus.`, ok: true });
    }
    if (!r.ok) return setMsg({ text: friendlyError(r) });
    setMsg({ text: "Code applied: Plus is unlocked for your case.", ok: true });
    await refreshMe();
    setTimeout(() => router.replace("/app"), 900);
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <PlanGrid
        action={(p) =>
          p === "free" ? (
            <button className="btn btn-block" onClick={() => void free()} disabled={busy !== null}>{busy === "free" ? "Opening your case…" : "Start free"}</button>
          ) : (
            <button className="btn btn-block btn-primary" onClick={() => void buy(p as Product)} disabled={busy !== null} aria-describedby="consent-text">
              {busy === p ? "Opening checkout…" : discount ? "Continue to Plus with your code" : suggest === "plus" ? "Continue to payment" : "Get Plus · $39"}
            </button>
          )
        }
      />
      <label className="check consent-row">
        <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span id="consent-text" className="small">For Plus: I want access to start straight away and understand I lose my 14-day withdrawal right once it starts.</span>
      </label>
      <form className="code-row" onSubmit={redeem} aria-label="Redeem a code">
        <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Have a code?" aria-label="Code" autoComplete="off" maxLength={40} />
        <button className="btn" disabled={!code.trim() || busy !== null}>{busy === "redeem" ? "Checking…" : "Apply"}</button>
      </form>
      {msg && <div className={msg.ok ? "notice notice-calm" : "error-box"} role="status">{msg.text}</div>}
      <FamilyAddon />
      <p className="tiny muted" style={{ margin: 0 }}>Prices in US dollars; checkout shows your currency and local methods such as BLIK and Przelewy24. Dodo Payments is the merchant of record. Charged once; nothing renews.</p>
    </div>
  );
}
