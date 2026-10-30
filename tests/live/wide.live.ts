import { expect, test } from "@playwright/test";
import { newPage, noHorizontalScroll, shot } from "./helpers";

// 1280px run: no model calls. Fresh own-case user, then check layouts of the main screens.
test("wide 1280: onboarding, case home, prepare form, letters, privacy ledger render without overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: "https://dossierly.pages.dev" });
  const page = await newPage(context, "wide");
  await page.goto("/");
  await shot(page, "20-wide-landing");
  await page.getByRole("link", { name: "Start my own case" }).first().click();
  await expect(page.getByRole("heading", { name: "Open a case file" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Your name").fill("Maya Kowalczyk-Test");
  await page.getByRole("button", { name: "Create my case" }).click();
  await expect(page.getByRole("heading", { name: "Maya's case" })).toBeVisible({ timeout: 30_000 });
  await shot(page, "21-wide-home");
  for (const [path, heading, name] of [["/app/prepare", "Prepare for an appointment", "22-wide-prepare"], ["/app/letters", "Read an official letter", "23-wide-letters"], ["/app/privacy", "What happened to your data", "24-wide-privacy"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
    expect(await noHorizontalScroll(page), `${path} overflows`).toBe(true);
    await shot(page, name);
  }
  await expect(page.getByText("chain verified")).toBeVisible({ timeout: 30_000 });
  await context.close();
});
