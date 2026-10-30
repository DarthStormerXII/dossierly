"use client";

import Link from "next/link";
import { useCase } from "@/lib/client/store";

/** Shows the plan this account is on. Plus came from a real Dodo checkout (paid, or $0 with a discount code). */
export function PlanStatus() {
  const { me } = useCase();
  if (!me) return null;
  const kind = me.plan.kind;
  const until = me.plan.expiresAt ? new Date(me.plan.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  if (kind === "free") {
    const used = me.lettersUsed ?? 0;
    const free = me.freeLetters ?? 3;
    return (
      <div className="plan-status">
        <div><span className="tab-label">Current plan</span><b>Free</b><small>{Math.min(used, free)} of {free} free letters used. Preparing and interpreting are not counted.</small></div>
      </div>
    );
  }
  return (
    <div className="plan-status is-plus">
      <div>
        <span className="tab-label">Current plan</span>
        <b>Dossierly Plus{me.plan.family ? " + Family" : ""}</b>
        <small>{until ? `Covers your case until ${until}.` : "Covers your case."} Paid once through Dodo Payments, which emailed your receipt. Nothing renews.</small>
      </div>
      <Link className="btn btn-small" href="/app/letters">Read a letter</Link>
    </div>
  );
}
