import { BuiltOn } from "@/components/landing/BuiltOn";
import { FinalCta, PricingTeaser } from "@/components/landing/Closing";
import { Countries } from "@/components/landing/Countries";
import { Hero } from "@/components/landing/Hero";
import { Journey } from "@/components/landing/Journey";
import { LandingMotion } from "@/components/landing/Motion";
import { Privacy } from "@/components/landing/Privacy";
import { Problem } from "@/components/landing/Problem";

export default function Landing() {
  return (
    <div className="lp">
      <Hero />
      <Problem />
      <Journey />
      <Privacy />
      <BuiltOn />
      <Countries />
      <PricingTeaser />
      <FinalCta />
      <LandingMotion />
    </div>
  );
}
