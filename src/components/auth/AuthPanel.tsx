"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeNext } from "@/lib/client/account";
import { getMe } from "@/lib/client/api";
import { EmailCodeForm } from "./EmailCodeForm";
import { Icon } from "../Icon";
import { Logo } from "../Logo";

type Mode = "signup" | "signin";

/** One email-code flow for creating an account and returning to it. */
export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = () => {
    const back = params.get("next");
    if (back) return router.replace(safeNext(back));
    const start = params.get("start");
    const plan = params.get("plan");
    const q = new URLSearchParams();
    if (start === "sample") q.set("start", "sample");
    if (plan === "plus") q.set("plan", "plus");
    const s = q.toString();
    router.replace(s ? `/app?${s}` : "/app");
  };

  // Email accounts can skip the form; earlier accounts can still verify an email.
  useEffect(() => {
    let active = true;
    void getMe().then((r) => { if (active && r.ok && r.data.accountKind === "email") next(); });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signup = mode === "signup";
  const qs = params.toString() ? `?${params.toString()}` : "";
  return (
    <div className="auth">
      <div className="auth-side">
        <div className="auth-top">
          <Link href="/" className="logo-link" aria-label="Dossierly home"><Logo size={24} /></Link>
          <Link href="/" className="auth-back"><span aria-hidden="true">←</span> Back to site</Link>
        </div>
      <div className="auth-card">
        <div className="auth-icon"><Icon name="lock" size={22} /></div>
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {signup ? "Start with your email. We’ll send a six-digit code. No password to remember." : "Enter your email and we’ll send a six-digit sign-in code."}
        </p>
        {signup && (
          <ul className="auth-points">
            <li><Icon name="check" size={16} /><span>Your case stays on your device, encrypted</span></li>
            <li><Icon name="check" size={16} /><span>A private agent of your own, in its own sandbox</span></li>
            <li><Icon name="check" size={16} /><span>Free to start: three letters, preparation and interpreting</span></li>
          </ul>
        )}
        <EmailCodeForm onVerified={next} />
        <p className="auth-foot">
          {signup ? <>Already have an account? <Link href={`/signin${qs}`}>Sign in</Link></> : <>New to Dossierly? <Link href={`/signup${qs}`}>Create an account</Link></>}
        </p>
        <p className="tiny muted" style={{ margin: 0, textAlign: "center" }}>
          By continuing you accept the <Link href="/legal/terms">terms</Link> and <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </div>
      </div>
      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual-img" />
        <div className="auth-quote">
          <div className="auth-bubble official"><small>Official · Polish</small>„Brakuje potwierdzenia ubezpieczenia zdrowotnego.”</div>
          <div className="auth-bubble you"><small>For you · English</small>Proof of health insurance is missing.</div>
          <p>Your own private agent prepares you, interprets at the counter and counts every deadline.</p>
        </div>
      </aside>
    </div>
  );
}
