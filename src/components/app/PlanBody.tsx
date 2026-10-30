"use client";

import { Checkout } from "@/components/site/Checkout";
import { useCase } from "@/lib/client/store";
import { PlanStatus } from "./PlanStatus";

/** First visit: the one-time plan step. Later: plan and billing, with the upgrade only while on Free. */
export function PlanBody({ suggest, reason }: { suggest?: "plus"; reason?: string }) {
  const { me } = useCase();
  const first = me?.planChosen === false;
  const onFree = !me || me.plan.kind === "free";
  const title = reason === "letters" ? "Keep every letter covered" : first ? "How would you like to start?" : "Plan and billing";
  const lead = reason === "letters"
    ? "Your three free letters are used. Plus reads every letter for the rest of your case."
    : first ? "Free needs no card. You can move to Plus whenever the letters start arriving." : "Pay once per case. Nothing renews.";
  return (
    <div className="page page-wide plan-step">
      <div className="plan-step-head">
        <span className="tab-label">{first ? "Last step" : "Plan"}</span>
        <h1 className="page-title">{title}</h1>
        <p className="muted lead">{lead}</p>
      </div>
      {!first && <PlanStatus />}
      {onFree && <Checkout suggest={suggest} />}
    </div>
  );
}
