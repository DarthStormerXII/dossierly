import Link from "next/link";
import { CoverageSection } from "@/components/site/Coverage";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { PricingSection } from "@/components/site/PlanGrid";
import { BuiltOn, PrivacySection } from "@/components/site/PrivacySection";

export default function Landing() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <PrivacySection />
      <BuiltOn />
      <CoverageSection />
      <PricingSection />
      <section className="section wrap">
        <div className="final-cta">
          <h2 style={{ margin: 0 }}>Try the whole journey on a sample case.</h2>
          <p className="muted" style={{ margin: "8px 0 18px" }}>Arjun&apos;s case is fictional; the office, the letter type and the deadline rules are real.</p>
          <div className="row">
            <Link className="btn btn-primary" href="/app?start=sample">Start with Arjun&apos;s sample case</Link>
            <Link className="btn" href="/app">Start my own case</Link>
          </div>
        </div>
      </section>
    </>
  );
}
