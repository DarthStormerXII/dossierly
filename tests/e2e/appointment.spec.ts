import { expect, test } from "@playwright/test";

// Runs against recorded fixtures (DEMO_FIXTURES=1, see playwright.config.ts): the full SAMPLE journey at phone width.
test("sample case: letter linked with deadline, then an interpreted appointment and wrap-up", async ({ page }) => {
  expect(page.viewportSize()?.width).toBeLessThan(500);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your residence case, remembered." })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Start with Arjun's sample case" }).first().click();
  await expect(page.getByRole("heading", { name: "Arjun's case" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("SAMPLE").first()).toBeVisible();
  await expect(page.getByText("No deadline is running.")).toBeVisible();

  // Letters: sample letter, read, delivery date, link
  await page.getByRole("link", { name: /Letters/ }).first().click();
  await page.getByRole("button", { name: "Use the sample letter" }).click();
  await expect(page.getByLabel("Polish text, exactly as printed")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Delivery date").fill("2026-10-27");
  await page.getByRole("button", { name: /Link to my case/ }).click();
  await expect(page.getByText("How we counted it", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add to case and set a reminder" }).click();
  await expect(page.getByText("Added to your case", { exact: false })).toBeVisible();

  // Case home now shows the deadline
  await page.getByRole("link", { name: "Back to case" }).click();
  await expect(page.getByText("The deadline that matters")).toBeVisible();

  // Meet: intro card, typed turns in table mode, wrap-up
  await page.getByRole("link", { name: /Meet/ }).first().click();
  await expect(page.getByLabel("Introduction for the official").locator(".intro-pl")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start interpreting" }).click();
  await expect(page.getByText("No audio is stored")).toBeVisible();
  const official = page.locator(".half-official");
  await official.getByRole("button", { name: "Wpisz" }).click();
  await official.getByPlaceholder("Proszę wpisać po polsku").fill("Dzień dobry. Proszę o paszport i potwierdzenie opłaty skarbowej.");
  await official.getByRole("button", { name: "Tłumacz" }).click();
  await expect(page.locator(".half-user .turn-trans").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "End" }).click();
  await expect(page.getByRole("heading", { name: "What was agreed" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Save to case" }).click();
  await expect(page.getByText("Saved to your case.")).toBeVisible();
});
