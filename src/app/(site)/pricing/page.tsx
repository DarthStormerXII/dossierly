import type { Metadata } from "next";
import { Checkout } from "@/components/site/Checkout";

export const metadata: Metadata = { title: "Pricing", description: "First letter free. Case Pass 149 zł once for one residence case. Credits that never expire." };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <span className="kicker">Pricing</span>
        <h1>Pay once for the case.</h1>
        <p>Your first letter is free. A residence case usually means several letters and a few visits over 18 months; the Case Pass covers them.</p>
      </div>
      {reason === "letters" && (
        <div className="notice notice-calm" style={{ marginBottom: 20, maxWidth: 720 }}>
          Your free letter has been used. A Case Pass or one credit reads the next one. Your case and its deadlines stay on your device either way.
        </div>
      )}
      <Checkout />
    </div>
  );
}
