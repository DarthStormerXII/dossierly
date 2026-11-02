import { describe, expect, it } from "vitest";
import { clearDocument, confirmedDossier, draftCase, freshDraft, orderNeeds, restoreDraft } from "../../src/lib/client/onboarding-state";
const letter = { readable: true, kind: "wezwanie_braki_formalne" as const, transcript: "Proszę dostarczyć podpisany załącznik.", title: "Request for signed attachment", office: "Mazowiecki Urząd Wojewódzki", caseNumber: "WSC-TEST", dateOnLetter: "2026-10-22", asks: ["Provide the signed attachment."], asksLocal: ["Proszę dostarczyć podpisany załącznik."], deadlineRule: { days: 14, from: "delivery", quote: "14 dni od doręczenia" }, fields: [], lowConfidence: [] };
const prepared = { checklist: [], phrases: [], changes: [] };

function own() {
  const draft = freshDraft();
  return { ...draft, source: "own" as const, answers: { ...draft.answers, name: "Anika", reason: "Work", stage: "Preparing an application", city: "Warsaw", needs: ["letters" as const, "documents" as const], main: "documents" as const }, facts: { ...letter, deadlineRule: { ...letter.deadlineRule, from: "delivery" as const } }, delivery: "2026-10-27", factsConfirmed: true, factsAccepted: true, reviews: { letters: { state: "reviewed" as const, note: "Checked" }, documents: { state: "skipped" as const, note: "Later" } } };
}
describe("onboarding client state boundaries", () => {
  it("passes reviewed extraction into preparation context once and preserves saved case context", () => {
    const draft = own(); const c = draftCase(draft);
    expect(c.events).toHaveLength(1); expect(c.events[0].summary).toContain(letter.asks[0]); expect(c.events[0].date).toBe(draft.delivery);
    expect(c.context).toEqual({ reason: "Work", stage: "Preparing an application", city: "Warsaw" });
    const saved = confirmedDossier(draft); expect(saved.case.events).toHaveLength(1); expect(saved.letters[0].extracted).toEqual(draft.facts); expect(saved.sample).toBe(false);
  });
  it("keeps sample existing documents and rejects saving any sample as an own case", () => {
    const draft = { ...own(), source: "sample" as const }; expect(draftCase(draft).documents.length).toBeGreaterThan(0);
    expect(() => confirmedDossier(draft)).toThrow(/own document/);
  });
  it("clears every fictional result before an explicitly empty own case", () => {
    const sample = { ...own(), source: "sample" as const, prepared, phrase: "fiction", notes: { letters: "fiction" }, pages: ["data:image/png;base64,eA=="] };
    const cleared = clearDocument(sample); expect(cleared.pages).toEqual([]); expect(cleared.prepared).toBeNull(); expect(cleared.facts).toBeNull(); expect(cleared.phrase).toBe(""); expect(cleared.notes).toEqual({});
    const saved = confirmedDossier({ ...cleared, source: "empty", reviews: sample.reviews }); expect(saved.case.events).toEqual([]); expect(saved.case.documents).toEqual([]); expect(saved.case.deadlines).toEqual([]); expect(saved.letters).toEqual([]); expect(saved.case.profile.name).toBe("Anika");
  });
  it("rejects unconfirmed or partially reviewed case completion", () => {
    expect(() => confirmedDossier({ ...own(), factsConfirmed: false })).toThrow();
    expect(() => confirmedDossier({ ...own(), reviews: {} })).toThrow(/every selected/);
  });
  it("orders the main priority first without losing other selected needs", () => {
    const draft = own(); expect(orderNeeds(draft)).toEqual(["documents", "letters"]);
    expect(orderNeeds({ ...draft, answers: { ...draft.answers, needs: ["letters"] } })).toEqual(["letters"]);
  });
  it("restores interrupted drafts without silently starting a new paid request", () => {
    const draft = own(); const restored = restoreDraft({ ...draft, pending: "read" }); expect(restored?.pending).toBeNull(); expect(restored?.error).toContain("interrupted");
    expect(restoreDraft({ ...draft, answers: { ...draft.answers, language: "unsupported" } })).toBeNull();
  });
});
