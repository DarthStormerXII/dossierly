import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { ScrubReturnParams } from "@/components/app/ScrubReturnParams";
import { currentAccount } from "@/lib/server/account";

export const metadata: Metadata = { title: "My case", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every /app page needs an account; visitors go to sign in. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  if (!account) redirect("/signin");
  return (
    <AppShell>
      <ScrubReturnParams />
      {children}
    </AppShell>
  );
}
