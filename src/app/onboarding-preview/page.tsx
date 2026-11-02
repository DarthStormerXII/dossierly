import type { Metadata } from "next";
import { OnboardingPreview } from "@/components/onboarding-preview/OnboardingPreview";
import "./preview.css";

export const metadata: Metadata = {
  title: "Onboarding preview",
  description: "Explore a sample Dossierly setup. No account changes or connections are made.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <OnboardingPreview />;
}
