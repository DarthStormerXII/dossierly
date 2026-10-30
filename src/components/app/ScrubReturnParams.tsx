"use client";

import { useEffect } from "react";

/** The payment provider returns with the buyer's email and payment id in the URL; drop them from the address bar and history. */
const PRIVATE_PARAMS = ["email", "payment_id", "status", "paid", "subscription_id"];

export function ScrubReturnParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!PRIVATE_PARAMS.some((p) => url.searchParams.has(p))) return;
    PRIVATE_PARAMS.forEach((p) => url.searchParams.delete(p));
    window.history.replaceState(window.history.state, "", url.pathname + (url.search || "") + url.hash);
  }, []);
  return null;
}
