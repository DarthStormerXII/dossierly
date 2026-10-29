import type { Metadata } from "next";
import { CountryCards } from "@/components/site/Coverage";

export const metadata: Metadata = { title: "Countries" };

export default function CountriesPage() {
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <span className="kicker">Countries</span>
        <h1>Where Dossierly works</h1>
        <p>Poland is supported today, in depth. Germany and France are next. We add a country only when its offices, letter types and deadline rules are covered from official sources.</p>
      </div>
      <CountryCards />
    </div>
  );
}
