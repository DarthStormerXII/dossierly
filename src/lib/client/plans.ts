import type { Product } from "./types";

export type PlanCard = {
  product: Product | "free"; name: string; price: string; per: string; note: string; points: string[]; featured?: boolean;
};

/** Two tiers. Prices in USD; Dodo Payments shows local currency and methods (BLIK, Przelewy24, cards) at checkout. */
export const PLANS: PlanCard[] = [
  {
    product: "free", name: "Free", price: "$0", per: "to start", note: "No card. One case.",
    points: [
      "3 official letters read, explained and linked to your case",
      "Prepare for appointments with cited checklists",
      "Live interpreting at the counter",
      "Deadlines counted with every step shown",
      "Your own private agent and privacy ledger",
    ],
  },
  {
    product: "case_pass", name: "Dossierly Plus", price: "$39", per: "once per case", note: "One residence case, 18 months. Nothing renews.", featured: true,
    points: [
      "Everything in Free, for the whole case",
      "Unlimited letters, linked and explained",
      "A Polish reply drafted for every letter",
      "Change alerts when official pages change",
      "Priority on your private agent",
    ],
  },
];

export const FAMILY_ADDON = { product: "family" as const, name: "Family add-on", price: "+$15", note: "A partner's or child's case alongside yours: shared deadlines, separate agents." };
