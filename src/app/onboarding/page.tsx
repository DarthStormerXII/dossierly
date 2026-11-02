import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/account";
import { getEnv } from "@/lib/server/env";
import { getOnboarding } from "@/lib/server/onboarding";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import "../onboarding-preview/preview.css";
import "../onboarding-preview/workbench.css";
import "./onboarding.css";
export const metadata: Metadata = { title: "Set up your case", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect("/signin?next=%2Fonboarding");
  const initial = await getOnboarding(getEnv(), account.accountId);
  const newCase = (await searchParams).new === "1";
  if (initial.status === "completed" && !newCase) redirect("/app");
  return <OnboardingFlow initial={initial} newCase={newCase} />;
}
