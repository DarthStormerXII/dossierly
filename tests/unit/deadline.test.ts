import { describe, expect, it } from "vitest";
import { computeDeadline, isWorkingDay, polishHolidays } from "@/lib/features/deadline";

const rule = (days: number | null, from: "delivery" | "letter_date" | null) => ({ days, from, quote: "w terminie 14 dni od dnia doręczenia" });

describe("computeDeadline", () => {
  it("the SAMPLE case: delivered 27 Oct 2026 + 14 days = 10 Nov 2026 (Tuesday)", () => {
    const d = computeDeadline({ rule: rule(14, "delivery"), deliveryDate: "2026-10-27", letterDate: "2026-10-22", language: "en" });
    expect(d?.date).toBe("2026-11-10");
    expect(d?.steps.join(" ")).toMatch(/Tuesday, 10 November 2026/);
    expect(d?.steps.join(" ")).toMatch(/not legal advice/);
  });
  it("counts from the letter date when the rule says so", () => {
    expect(computeDeadline({ rule: rule(7, "letter_date"), deliveryDate: "2026-10-27", letterDate: "2026-10-20", language: "en" })?.date).toBe("2026-10-27");
  });
  it("returns null when the letter states no count or the start date is unknown", () => {
    expect(computeDeadline({ rule: rule(null, null), deliveryDate: "2026-10-27", letterDate: null, language: "en" })).toBeNull();
    expect(computeDeadline({ rule: rule(7, "letter_date"), deliveryDate: "2026-10-27", letterDate: null, language: "en" })).toBeNull();
  });
  it("moves a Saturday or Sunday deadline to Monday", () => {
    // 2026-11-07 is a Saturday: delivered 24 Oct + 14 days.
    const d = computeDeadline({ rule: rule(14, "delivery"), deliveryDate: "2026-10-24", letterDate: null, language: "en" });
    expect(d?.date).toBe("2026-11-09");
    expect(d?.steps.join(" ")).toMatch(/Saturday/);
  });
  it("moves a public-holiday deadline (11 Nov, Independence Day, is a Wednesday in 2026)", () => {
    const d = computeDeadline({ rule: rule(14, "delivery"), deliveryDate: "2026-10-28", letterDate: null, language: "en" });
    expect(d?.date).toBe("2026-11-12");
    expect(d?.steps.join(" ")).toMatch(/public holiday/);
  });
  it("localises the steps", () => {
    for (const lang of ["uk", "hi", "ta"] as const) {
      const d = computeDeadline({ rule: rule(14, "delivery"), deliveryDate: "2026-10-27", letterDate: null, language: lang });
      expect(d?.steps).toHaveLength(5);
      expect(d?.steps.join("")).not.toMatch(/Tuesday|not legal advice/);
    }
  });
});

describe("Polish calendar", () => {
  it("knows the movable holidays of 2026 (Easter 5 Apr)", () => {
    const h = polishHolidays(2026);
    expect(h.has("2026-04-05")).toBe(true);
    expect(h.has("2026-04-06")).toBe(true);
    expect(h.has("2026-06-04")).toBe(true); // Corpus Christi
    expect(h.has("2026-05-24")).toBe(true); // Pentecost Sunday
    expect(h.has("2026-12-24")).toBe(true);
  });
  it("treats weekends and holidays as non-working", () => {
    expect(isWorkingDay(new Date(Date.UTC(2026, 10, 10)))).toBe(true);
    expect(isWorkingDay(new Date(Date.UTC(2026, 10, 11)))).toBe(false);
    expect(isWorkingDay(new Date(Date.UTC(2026, 10, 14)))).toBe(false);
  });
});
