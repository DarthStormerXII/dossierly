import type { Product } from "./types";

export type PlanCard = { product: Product | "free"; name: string; price: string; note: string; points: string[]; featured?: boolean };

export const PLANS: PlanCard[] = [
  { product: "free", name: "First letter", price: "Free", note: "no card needed", points: ["Read and explain one official letter", "Linked to your case, deadline counted", "Draft Polish cover letter"] },
  {
    product: "case_pass", name: "Case Pass", price: "149 zł", note: "once, for one residence case · 18 months", featured: true,
    points: ["Unlimited letters", "Deadline tracking and reminders", "Your private agent remembers the case", "Preparation with cited checklists", "3 interpreted appointments"],
  },
  { product: "credits_10", name: "10 credits", price: "59 zł", note: "never expire", points: ["A letter uses 1 credit", "An interpreted appointment uses 5"] },
  { product: "credits_25", name: "25 credits", price: "129 zł", note: "never expire", points: ["A letter uses 1 credit", "An interpreted appointment uses 5"] },
  { product: "family", name: "Family add-on", price: "+59 zł", note: "with a Case Pass", points: ["A partner's or child's case alongside yours", "Shared deadlines, separate agents"] },
];
