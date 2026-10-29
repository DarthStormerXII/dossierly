import { describe, expect, it } from "vitest";
import { guardUserUtterance, SAFETY_NOTICE } from "@/lib/safety";

describe("safety guard", () => {
  it.each([
    "Should I sign this contract?",
    "Is it legal for the landlord to ask for this?",
    "What dose of this medicine should I take?",
    "Should I stop taking my tablets before the test?",
    "क्या यह कानूनी है?",
    "Чи це законно?",
    "இந்த மருந்து எடுக்கலாமா? மருந்து பற்றி கேட்கிறேன்",
  ])("flags advice requests: %s", (text) => {
    expect(guardUserUtterance(text).flagged).toBe(true);
  });

  it.each(["I have my passport.", "Where do I pay the fee?", "Yes, I will bring a copy tomorrow.", "My appointment is at ten."])(
    "lets ordinary speech through: %s",
    (text) => {
      expect(guardUserUtterance(text).flagged).toBe(false);
    },
  );

  it("trusts the model flag even when patterns miss", () => {
    expect(guardUserUtterance("Tell me what to do", true).flagged).toBe(true);
  });

  it("has a notice in every language that says it only interprets", () => {
    expect(SAFETY_NOTICE.en).toMatch(/only interpret/i);
    expect(Object.keys(SAFETY_NOTICE).sort()).toEqual(["en", "hi", "ta", "uk"]);
  });
});
