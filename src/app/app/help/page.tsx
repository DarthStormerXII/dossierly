import type { Metadata } from "next";
import { HelpPage } from "@/components/app/help/HelpPage";

export const metadata: Metadata = { title: "How it works" };

export default function Help() {
  return <HelpPage />;
}
