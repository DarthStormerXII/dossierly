import { describe, expect, it } from "vitest";
import { LANGUAGES, LanguageSchema, CaseSchema } from "@/lib/schemas";
import { LANGUAGE_META } from "@/lib/config";
import { SAFETY_NOTICE } from "@/lib/safety";
import { fillPrompt } from "@/lib/agent/prompt";
import { glossaryFor } from "@/lib/features/prompts";
import { computeDeadline } from "@/lib/features/deadline";
import { letterFixture } from "@/lib/features/fixtures";
import { sampleCase } from "@/lib/client/sample";

describe("eight typed languages without fake replay or voice promises", () => {
  it.each(LANGUAGES)("validates and routes %s across case/agent/deadline/safety text", (language) => {
    expect(LanguageSchema.parse(language)).toBe(language);
    expect(CaseSchema.parse({ ...sampleCase(), profile: { name: "Ananya Rao", language } }).profile.language).toBe(language);
    expect(fillPrompt("Respond in {{LANGUAGE}}", language)).toContain(LANGUAGE_META[language].english);
    expect(glossaryFor(language)).not.toContain("undefined");
    expect(SAFETY_NOTICE[language].length).toBeGreaterThan(20);
    const deadline = computeDeadline({ rule: { days: 14, from: "delivery", quote: "w terminie 14 dni od dnia doręczenia" }, deliveryDate: "2026-10-27", letterDate: null, language });
    expect(deadline?.date).toBe("2026-11-10"); expect(deadline?.steps).toHaveLength(5);
    if (language !== "en") expect(deadline?.steps.join(" ")).not.toContain("Starting point");
  });
  it("refuses unsupported recorded-language output rather than returning English as the chosen language", () => {
    expect(() => letterFixture({ pages: ["data:image/png;base64,AAAA"], language: "ja" }, "ja")).toThrow(/No recorded fixture/);
  });
  it("refuses impossible delivery dates rather than silently normalizing them", () => {
    expect(computeDeadline({ rule: { days: 14, from: "delivery", quote: "14 dni" }, deliveryDate: "2026-02-31", letterDate: null, language: "en" })).toBeNull();
  });
});
