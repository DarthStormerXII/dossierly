"use client";

import { useEffect } from "react";
import { signInUrl } from "@/lib/client/account";

/** Sends a visitor without a valid session to sign-in, remembering where they were going. */
export function GoSignIn() {
  useEffect(() => { window.location.replace(signInUrl()); }, []);
  return <p className="app-pad muted">Taking you to sign in…</p>;
}
