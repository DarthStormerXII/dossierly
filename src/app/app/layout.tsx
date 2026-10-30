import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { ScrubReturnParams } from "@/components/app/ScrubReturnParams";

export const metadata: Metadata = { title: "My case", robots: { index: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ScrubReturnParams />
      {children}
    </AppShell>
  );
}
