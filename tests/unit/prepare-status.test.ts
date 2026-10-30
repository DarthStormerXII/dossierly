import { describe, expect, it } from "vitest";
import { applyCaseStatus, bestExcerpt, enforcePrepareCitations } from "@/lib/agent/citations";

const docs = [
  { name: "Passport (all pages)", have: true },
  { name: "Photo 35×45 mm", have: true },
  { name: "Stamp duty receipt 440 zł", have: true },
  { name: "Card fee receipt 100 zł", have: true },
  { name: "Employer attachment no. 1 (Załącznik nr 1)", have: true },
  { name: "Rental agreement (umowa najmu)", have: true },
  { name: "Proof of health insurance for the whole stay", have: false },
];
const cite = { url: "https://migrant.wsc.mazowieckie.pl/x", title: "Procedure", quote: "q" };
const item = (name: string) => ({ item: name, status: "check" as const, citation: cite });

describe("checklist status comes from the case's documents", () => {
  it("marks held, missing and unknown items", () => {
    const r = applyCaseStatus({ checklist: [
      item("Original passport"), item("Proof of health insurance covering the whole stay"),
      item("Proof that the 100 zł card fee was paid"), item("Appointment notice for card collection"),
    ], phrases: [], changes: [] }, docs);
    expect(r.checklist.map((c) => c.status)).toEqual(["have", "missing", "have", "check"]);
  });
});

describe("citation repair", () => {
  const text = "Wniosek składa się osobiście. Do wniosku dołącz paszport oraz fotografię 35x45 mm. Opłata za kartę pobytu wynosi 100 zł.";
  it("keeps a verbatim quote", () => {
    const r = enforcePrepareCitations({ checklist: [{ item: "Passport", status: "check", citation: { url: "u", title: "t", quote: "Do wniosku dołącz paszport" } }], phrases: [], changes: [] }, [{ url: "u", title: "T", text }]);
    expect(r.report.repaired).toBe(0);
  });
  it("replaces a non-verbatim quote with the best-matching sentence, not the passage opening", () => {
    expect(bestExcerpt(text, "card fee 100 zł opłata karta")).toBe("Opłata za kartę pobytu wynosi 100 zł.");
  });
});
