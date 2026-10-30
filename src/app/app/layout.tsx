import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { GoSignIn } from "@/components/auth/GoSignIn";
import { ScrubReturnParams } from "@/components/app/ScrubReturnParams";
import { currentAccount } from "@/lib/server/account";

export const metadata: Metadata = { title: "My case", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every /app page needs an account: no valid session goes to sign-in with ?next=, before any app code runs. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  if (!account) return <GoSignIn />;
  return (
    <AppShell>
      <ScrubReturnParams />
      {children}
    </AppShell>
  );
}
