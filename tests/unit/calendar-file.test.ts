import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/client/ics";

describe("reviewed all-day calendar-file export", () => {
  it("uses an exclusive end date across year boundaries and keeps proper CRLF", () => {
    const ics = buildIcs([{ date: "2026-12-31", title: "Review office letter", uid: "deadline-1" }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
  });
  it("escapes text and never lets text or UID inject an attendee or extra event", () => {
    const ics = buildIcs([{ date: "2026-11-18", title: "Review; letter, original\r\nATTENDEE:mailto:other@example.org", description: "Question\rKeep context\nno writes", uid: "id\r\nBEGIN:VEVENT" }]);
    expect(ics.split("\r\n").filter((line) => line.startsWith("BEGIN:VEVENT"))).toHaveLength(1);
    expect(ics.split("\r\n").some((line) => line.startsWith("ATTENDEE:"))).toBe(false);
    expect(ics).toContain("Review\\; letter\\, original\\nATTENDEE");
  });
  it("rejects impossible dates and folds multilingual UTF-8 lines without losing text", () => {
    const title = "Підготувати документи 日本語 ".repeat(12);
    const ics = buildIcs([{ date: "2026-02-31", title: "invalid", uid: "bad" }, { date: "2026-11-18", title, uid: "good" }]);
    expect(ics).not.toContain("20260231");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replaceAll("\r\n ", "")).toContain(`SUMMARY:${title}`);
  });
});
