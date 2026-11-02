import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
export const letter = { readable: true, kind: "wezwanie_braki_formalne" as const, transcript: "Mazowiecki Urząd Wojewódzki\nWezwanie do uzupełnienia dokumentów. Proszę dostarczyć podpisany załącznik w terminie 14 dni od doręczenia.", title: "Request for a signed attachment", office: "Mazowiecki Urząd Wojewódzki", caseNumber: "WSC-2026-TEST", dateOnLetter: "2026-10-22", asks: ["Provide the signed attachment."], asksLocal: ["Proszę dostarczyć podpisany załącznik."], deadlineRule: { days: 14, from: "delivery", quote: "w terminie 14 dni od doręczenia" }, fields: [], lowConfidence: [] };
export const run = { model: "test-boundary", ms: 1, tokensIn: 1, tokensOut: 1, cachedTokens: 0, costUsd: 0, ranOn: "cloud" };
export const prepared = { checklist: [{ item: "Signed attachment requested in your letter", status: "missing", citation: { title: "Official document instructions", url: "https://www.gov.pl/web/uw-mazowiecki", quote: "Check the requirements stated in the letter." } }], phrases: [{ local: "Chcę sprawdzić załącznik.", user: "I want to check the attachment." }], changes: [] };
export async function resetMetadata(page: Page) {
  if (process.env.ONBOARDING_REAL_ACCOUNTS) {
    const fixtures = JSON.parse(readFileSync(process.env.ONBOARDING_REAL_ACCOUNTS, "utf8"));
    const index = createHash("sha256").update(test.info().testId).digest()[0];
    await page.context().addCookies(fixtures[index].cookies);
  }
  const current = await page.request.get("/api/onboarding"); expect(current.ok()).toBeTruthy();
  const state = await current.json();
  const reset = await page.request.post("/api/onboarding", { data: { action: "restart", expectedRevision: state.revision, confirmed: true }, headers: { origin: "http://127.0.0.1:3295" } }); expect(reset.ok()).toBeTruthy();
}
export async function mocks(page: Page) {
  const counts = { read: 0, prepare: 0, link: 0, prepareCase: null as null | Record<string, unknown>, ask: 0, stop: 0 };
  await page.route("**/api/status", (route) => route.fulfill({ json: { models: [], bridge: { online: false, lastSeen: null, sandboxes: 0 } } }));
  await page.route("**/api/letters/read", (route) => { counts.read++; return route.fulfill({ json: { letter, run } }); });
  await page.route("**/api/letters/link", (route) => { counts.link++; return route.fulfill({ json: { link: { explanation: "The reviewed letter requests a signed attachment.", relatedEventIds: [], stillOpen: ["Provide the attachment."] }, deadline: { date: "2026-11-10", steps: ["14 days after the confirmed delivery date."] }, draftLocal: "Proszę o potwierdzenie.", draftUser: "Please confirm.", runs: [] } }); });
  await page.route("**/api/prepare", (route) => { counts.prepare++; counts.prepareCase = route.request().postDataJSON().case; return route.fulfill({ json: { taskId: "prepare-ui-boundary", retrieval: { embeddings: false, pages: 1, origin: "bundled", sources: [{ url: "https://www.gov.pl/web/uw-mazowiecki", fetchedAt: "2026-10-20T08:00:00Z", kind: "bundled" }] } } }); });
  await page.route("**/api/agent/tasks/prepare-ui-boundary", (route) => route.fulfill({ json: { id: "prepare-ui-boundary", kind: "prepare", status: "done", result: prepared, trace: [], ranOn: "cloud" } }));
  await page.route("**/api/interpret", (route) => route.fulfill({ json: { translation: "Czy ten załącznik jest poprawny?", adviceNotice: null, masked: 0, run } }));
  await page.route("**/api/hub/changes?*", (route) => route.fulfill({ json: { changes: [], kind: "official_pages", personalApplicationStatus: false, checkedAt: null } }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: { capabilities: ["gmail", "outlook", "googlecalendar", "microsoftcalendar"].map((provider) => ({ provider, category: provider.includes("calendar") ? "calendar" : "mail", available: false, reason: "This connection is not available yet." })), connections: { mail: null, calendar: null } } }));
  return counts;
}
export async function details(page: Page, all = true) {
  await page.goto("/onboarding");
  await page.getByLabel("Full name").fill("Anika Raman"); await page.getByRole("button", { name: "Continue →" }).click();
  await page.getByRole("radio", { name: "Work", exact: true }).press("Space");
  await page.getByRole("button", { name: /Where are you in the process/ }).click(); await page.getByRole("option", { name: "Preparing an application", exact: true }).click();
  await page.getByLabel(/City in Poland/).fill("Warsaw"); await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  if (all) for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.press("Space");
  else await page.getByRole("checkbox", { name: /Understand letters/ }).press("Space");
  await page.getByRole("button", { name: "Continue →" }).click();
}
export async function sampleFacts(page: Page) {
  await page.getByRole("button", { name: "Read the fictional sample", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the facts against the original" })).toBeVisible();
  await page.getByRole("checkbox", { name: /I checked these facts/ }).press("Space"); await page.getByRole("button", { name: "Use these reviewed facts" }).click();
}
export async function emptyFinish(page: Page) {
  await page.getByRole("button", { name: /Start my own case without a letter/ }).click();
  await page.getByRole("button", { name: "Review my setup" }).click();
  await page.getByRole("checkbox", { name: /Save this reviewed own case/ }).press("Space");
  await page.getByRole("button", { name: "Save my own case and open workspace" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "What would you like to understand?" })).toBeVisible();
}
