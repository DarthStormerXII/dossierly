"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaseProvider, useCase } from "@/lib/client/store";
import { Icon, type IconName } from "../Icon";
import { Logo } from "../Logo";
import { Onboarding } from "./Onboarding";
import { Loading } from "../States";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/app", label: "Case", icon: "case" },
  { href: "/app/prepare", label: "Prepare", icon: "prepare" },
  { href: "/app/meet", label: "Meet", icon: "meet" },
  { href: "/app/letters", label: "Letters", icon: "letter" },
  { href: "/app/privacy", label: "Privacy", icon: "shield" },
];

function AgentBadge() {
  const { status, dossier } = useCase();
  if (!status) return <span className="chip agent-chip" aria-live="polite">Agent…</span>;
  const online = status.bridge.online;
  return (
    <span className={`chip agent-chip${online ? " is-online" : ""}`} title={online ? "Your private agent sandbox is online" : "Private agent offline: tasks run in the cloud fallback"}>
      <span className="agent-dot" aria-hidden="true" />
      <span className="agent-label">{online ? (dossier?.sample ? "Shared sample agent" : "Agent online") : "Cloud fallback"}</span>
      <span className="agent-short">{online ? "Agent" : "Cloud"}</span>
    </span>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  const { phase, unlockVault } = useCase();
  if (phase === "loading") return <div className="app-pad"><Loading label="Opening your encrypted case…" /></div>;
  if (phase === "unavailable")
    return (
      <div className="app-pad card">
        <h2>This browser blocks private storage</h2>
        <p>Dossierly keeps your case encrypted on this device, which needs IndexedDB. Private browsing windows often switch it off. Open Dossierly in a normal window to continue.</p>
      </div>
    );
  if (phase === "locked")
    return (
      <div className="app-pad card stack">
        <span className="tab-label"><Icon name="lock" size={16} /> Locked with your passkey</span>
        <h2>Unlock your case</h2>
        <p className="muted">Your case is encrypted with a key that only your passkey can recreate.</p>
        <button className="btn btn-primary" onClick={() => void unlockVault().catch(() => undefined)}>Unlock with passkey</button>
      </div>
    );
  if (phase === "empty") return <Onboarding />;
  return <>{children}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { dossier } = useCase();
  return (
    <div className="app">
      <header className="app-header">
        <Link href="/" className="logo-link" aria-label="Dossierly home"><Logo size={26} /></Link>
        <span className="chip chip-ai" title="You are using an AI system">AI</span>
        {dossier?.sample && <span className="stamp" title="Fictional sample case">SAMPLE</span>}
        <span className="grow" />
        <AgentBadge />
      </header>
      <nav className="app-nav" aria-label="Case sections">
        {NAV.map((n) => {
          const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <main className="app-main" id="main">
        <Body>{children}</Body>
      </main>
      <footer className="app-foot tiny muted">
        <span>Interprets and explains only. Not legal or medical advice.</span>
        <span className="row" style={{ gap: 14 }}>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/limits">Limits</Link>
          <Link href="/countries">Countries</Link>
        </span>
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CaseProvider>
      <Shell>{children}</Shell>
    </CaseProvider>
  );
}
