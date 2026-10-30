import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default function SignUpPage() {
  return <Suspense><AuthPanel mode="signup" /></Suspense>;
}
