"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { deviceSignUp, friendlyError, passkeySignIn, passkeySignUp, passkeySupported } from "@/lib/client/api";
import { Icon } from "../Icon";

type Mode = "signup" | "signin";

/** Passkey-first accounts: no email, no password. A device-only account is the fallback so nobody is ever blocked. */
export function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [canPasskey, setCanPasskey] = useState(true);
  const [busy, setBusy] = useState<"passkey" | "device" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void Promise.resolve(passkeySupported()).then(setCanPasskey); }, []);

  const next = () => {
    const start = params.get("start");
    const plan = params.get("plan");
    const q = new URLSearchParams();
    if (start === "sample") q.set("start", "sample");
    if (plan === "plus") q.set("plan", "plus");
    const s = q.toString();
    router.replace(s ? `/app?${s}` : "/app");
  };

  const run = async (kind: "passkey" | "device") => {
    setBusy(kind);
    setError(null);
    const r = kind === "device" ? await deviceSignUp() : mode === "signup" ? await passkeySignUp() : await passkeySignIn();
    setBusy(null);
    if (r.ok) return next();
    if (r.code === "cancelled") return;
    setError(r.code === "no_credential" ? "No Dossierly passkey on this device. Create an account instead." : friendlyError(r));
  };

  const signup = mode === "signup";
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-icon"><Icon name="lock" size={26} /></div>
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {signup ? "One tap with a passkey: your face, fingerprint or screen lock. No email, no password." : "Sign in with the passkey you made for Dossierly."}
        </p>
        {signup && (
          <ul className="auth-points">
            <li><Icon name="check" size={16} /><span>Your case stays on your device, encrypted</span></li>
            <li><Icon name="check" size={16} /><span>A private agent of your own, in its own sandbox</span></li>
            <li><Icon name="check" size={16} /><span>Free to start: three letters, preparation and interpreting</span></li>
          </ul>
        )}
        {canPasskey && (
          <button className="btn btn-primary btn-block" onClick={() => void run("passkey")} disabled={busy !== null}>
            {busy === "passkey" ? "Waiting for your passkey…" : signup ? "Continue with a passkey" : "Sign in with a passkey"}
          </button>
        )}
        {signup && (
          <>
            {canPasskey && <div className="auth-or">or</div>}
            <button className={`btn btn-block${canPasskey ? "" : " btn-primary"}`} onClick={() => void run("device")} disabled={busy !== null}>
              {busy === "device" ? "Creating…" : "Continue on this device only"}
            </button>
            <p className="tiny muted" style={{ margin: 0, textAlign: "center" }}>Without a passkey you can only return from this browser.</p>
          </>
        )}
        {error && <div className="error-box small" role="alert">{error}</div>}
        <p className="auth-foot">
          {signup ? <>Already have an account? <Link href="/signin">Sign in</Link></> : <>New to Dossierly? <Link href="/signup">Create an account</Link></>}
        </p>
        <p className="tiny muted" style={{ margin: 0, textAlign: "center" }}>
          By continuing you accept the <Link href="/legal/terms">terms</Link> and <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </div>
    </div>
  );
}
