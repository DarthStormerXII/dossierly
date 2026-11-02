"use client";
import Link from "next/link";
import { ConnectionsStep } from "@/components/onboarding/ConnectionsStep";
import { useDossier } from "@/lib/client/store";
import "../../onboarding-preview/preview.css";
import "../../onboarding-preview/workbench.css";
import "../../onboarding/onboarding.css";
export default function ConnectionsPage() {
  const dossier = useDossier();
  const date = [...dossier.case.deadlines].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  return <div className="op-preview ob-flow"><div className="op-shell"><header className="op-heading"><Link href="/app">← Your case</Link><h1>Mail and calendar</h1><p>Review permissions and dates before taking action. Your case remains usable without a connection.</p></header><ConnectionsStep beforeLeave={async () => {}} returnPath="/app" date={date} sample={dossier.sample} /></div></div>;
}
