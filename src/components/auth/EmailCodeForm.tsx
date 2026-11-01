"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { verifyEmailCode } from "@/lib/client/api";
import { emailError, emailSchema, requestEmailCode } from "@/lib/client/email-auth";

type Challenge = { id: string; email: string; expiresAt: number };

export function EmailCodeForm({ onVerified }: { onVerified(): void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const [spent, setSpent] = useState(false);
  const pending = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const expired = !!challenge && now >= challenge.expiresAt;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (challenge) codeInput.current?.focus(); }, [challenge]);

  async function send() {
    if (pending.current || Date.now() < retryAt) return;
    const parsed = emailSchema.safeParse(challenge?.email ?? email);
    if (!parsed.success) { setError("Enter a valid email address."); emailInput.current?.focus(); return; }
    pending.current = true;
    setBusy("send"); setError(""); setNotice("");
    const r = await requestEmailCode(parsed.data);
    const time = Date.now();
    setNow(time); setBusy(null); pending.current = false;
    if (!r.ok) {
      setError(emailError(r));
      if (r.code === "rate_limited" || r.status === 429) setRetryAt(time + 60_000);
      return;
    }
    setChallenge({ id: r.data.challengeId, email: parsed.data, expiresAt: time + r.data.expiresIn * 1000 });
    setRetryAt(time + r.data.resendAfter * 1000);
    setCode(""); setSpent(false);
    setNotice(challenge ? "A new code is on its way. Use the code from the latest email." : "Code sent. Check your inbox and spam folder.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return send();
    if (pending.current || spent) return;
    if (Date.now() >= challenge.expiresAt) { setNow(Date.now()); setError("That code has expired. Request a new code to continue."); return; }
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit code from your email."); codeInput.current?.focus(); return; }
    pending.current = true;
    setBusy("verify"); setError(""); setNotice("");
    const r = await verifyEmailCode(challenge.id, code);
    if (r.ok) { onVerified(); return; }
    pending.current = false; setBusy(null); setError(emailError(r));
    if (r.code === "expired_code" || r.code === "too_many_attempts") setSpent(true);
    if (r.code === "rate_limited" || r.status === 429) setRetryAt(Date.now() + 60_000);
    codeInput.current?.focus();
  }

  function changeEmail() {
    setChallenge(null); setCode(""); setSpent(false); setError(""); setNotice("");
    requestAnimationFrame(() => emailInput.current?.focus());
  }

  return (
    <form className="auth-email-form" onSubmit={(event) => void submit(event)} noValidate aria-busy={busy !== null}>
      {challenge ? (
        <>
          <div className="auth-recipient">
            <p className="small">Enter the code sent to <strong>{challenge.email}</strong></p>
            <button type="button" className="btn btn-ghost btn-small" onClick={changeEmail} disabled={busy !== null}>Change email</button>
          </div>
          <label className="field">
            <span>Six-digit code</span>
            <input ref={codeInput} className="input auth-code" name="code" type="text" inputMode="numeric"
              autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").replace(/[\s-]/g, "");
                if (/^\d{6}$/.test(pasted)) { event.preventDefault(); setCode(pasted); setError(""); }
              }}
              disabled={busy !== null || spent || expired} aria-describedby="code-help auth-feedback" aria-invalid={!!error} />
          </label>
          <p id="code-help" className="tiny muted">{expired ? "This code has expired. Request a new one below." : "Your code expires in 10 minutes. Use it only on Dossierly."}</p>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy !== null || spent || expired}>
            {busy === "verify" ? "Signing you in…" : "Verify and continue"}
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={() => void send()} disabled={busy !== null || seconds > 0}>
            {busy === "send" ? "Sending a new code…" : seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
          </button>
        </>
      ) : (
        <>
          <label className="field">
            <span>Email address</span>
            <input ref={emailInput} className="input" name="email" type="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck={false} maxLength={254} required value={email}
              onChange={(event) => { setEmail(event.target.value); setError(""); }} disabled={busy !== null}
              aria-describedby="auth-feedback" aria-invalid={!!error} />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy !== null || seconds > 0}>
            {busy === "send" ? "Sending your code…" : seconds > 0 ? `Send code in ${seconds}s` : "Send me a code"}
          </button>
        </>
      )}
      <div id="auth-feedback">
        {error && <p className="error-box small" role="alert">{error}</p>}
        {notice && <p className="small muted" role="status">{notice}</p>}
      </div>
    </form>
  );
}
