"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CaseProvider, useCase } from "@/lib/client/store";
import { Icon, type IconName } from "../Icon";
import { Logo } from "../Logo";
import { IdentityMenu } from "./IdentityMenu";
import { Onboarding } from "./Onboarding";
import { Loading } from "../States";

type NavItem = { href: string; label: string; icon: IconName };
const TABS: NavItem[] = [
  { href: "/app", label: "Case", icon: "case" },
  { href: "/app/prepare", label: "Prepare", icon: "prepare" },
  { href: "/app/meet", label: "Meet", icon: "meet" },
  { href: "/app/letters", label: "Letters", icon: "letter" },
  { href: "/app/privacy", label: "Privacy", icon: "shield" },
];
/** Desktop sidebar groups; phones use TABS in the bottom bar and reach Learn through the account menu. */
const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Case", items: [{ href: "/app", label: "Overview", icon: "case" }] },
  { label: "Work", items: [TABS[1], TABS[2], TABS[3]] },
  { label: "Records", items: [{ href: "/app/privacy", label: "Privacy ledger", icon: "shield" }] },
  { label: "Learn", items: [
    { href: "/app/help", label: "How it works", icon: "book" },
    { href: "/app/plan", label: "Plan and billing", icon: "card" },
  ] },
];
const isActive = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

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
  const { phase } = useCase();
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
        <span className="tab-label"><Icon name="lock" size={16} /> Stored case locked</span>
        <h2>Your existing case is preserved</h2>
        <p className="muted">This case uses an earlier encryption setup that is not available in the current sign-in flow. Email sign-in cannot unlock it. The stored case has not been changed.</p>
      </div>
    );
  if (phase === "empty") return <Onboarding />;
  return <>{children}</>;
}

/** After onboarding, everyone picks Free or Plus once; until then the app routes to the plan step. */
function usePlanStep() {
  const { phase, me } = useCase();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (phase !== "ready" || !me || me.planChosen !== false || path === "/app/plan") return;
    const plus = new URLSearchParams(window.location.search).get("plan") === "plus";
    router.replace(plus ? "/app/plan?plan=plus" : "/app/plan");
  }, [phase, me, path, router]);
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { dossier } = useCase();
  usePlanStep();
  return (
    <div className="app">
      <aside className="app-side" aria-label="Case navigation">
        <div className="side-top">
          <Link href="/app" className="logo-link" aria-label="Dossierly, your case"><Logo size={24} /></Link>
          <span className="chip chip-ai" title="You are using an AI system">AI</span>
        </div>
        <nav className="side-nav" aria-label="Sections">
          {GROUPS.map((g) => (
            <div key={g.label} className="side-group">
              <span className="side-label">{g.label}</span>
              {g.items.map((n) => {
                const active = isActive(path, n.href);
                return (
                  <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                    <Icon name={n.icon} size={18} /><span>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <AgentBadge />
          <IdentityMenu />
        </div>
      </aside>
      <header className="app-header">
        <Link href="/app" className="logo-link" aria-label="Dossierly, your case"><Logo size={22} /></Link>
        <span className="chip chip-ai" title="You are using an AI system">AI</span>
        {dossier?.sample && <span className="stamp" title="Fictional sample case">Sample</span>}
        <span className="grow" />
        <AgentBadge />
        <IdentityMenu compact />
      </header>
      <nav className="app-nav" aria-label="Case sections">
        {TABS.map((n) => {
          const active = isActive(path, n.href);
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
