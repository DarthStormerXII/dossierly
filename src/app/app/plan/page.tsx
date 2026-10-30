import { Checkout } from "@/components/site/Checkout";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ plan?: string; reason?: string }> }) {
  const { plan, reason } = await searchParams;
  return (
    <div className="page page-wide plan-step">
      <div className="plan-step-head">
        <span className="tab-label">{reason === "letters" ? "Plan" : "Last step"}</span>
        <h1 className="page-title">{reason === "letters" ? "Keep every letter covered" : "How would you like to start?"}</h1>
        <p className="muted lead">{reason === "letters" ? "Your three free letters are used. Plus reads every letter for the rest of your case." : "Free needs no card. You can move to Plus whenever the letters start arriving."}</p>
      </div>
      <Checkout suggest={plan === "plus" ? "plus" : undefined} />
    </div>
  );
}
