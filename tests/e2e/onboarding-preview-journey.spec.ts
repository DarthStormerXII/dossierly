import { expect, test } from "@playwright/test";
import { advance, choose, confirmExample, toPriorities } from "./onboarding-preview.helpers";

const priorities = ["Understand letters", "Prepare documents", "Track deadlines", "Prepare for appointments", "Communicate with the office", "Follow application updates"];
const ids = ["letters", "documents", "deadlines", "appointments", "communicate", "updates"];

test("three needs retain edits and evidence, and jumping to the last never bypasses pending examples", async ({ page }) => {
  await toPriorities(page);
  for (const priority of priorities.slice(0, 3)) await page.getByRole("checkbox", { name: new RegExp(`^${priority}`) }).press("Space");
  await choose(page, "What matters most", "Prepare documents");
  await advance(page);
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "documents");
  await expect(page.locator(".op-journey-heading")).toContainText("Example 1 of 3");
  await page.getByRole("button", { name: "Explain this sample" }).click();
  await page.locator("textarea").fill("Ask which insurance document is accepted, then check the copy.");
  await page.getByRole("button", { name: "Checklist note", exact: true }).click();
  await page.getByRole("button", { name: /^Example 3:/ }).click();
  await confirmExample(page, "Review the original appointment time with Arjun.");
  await page.getByRole("button", { name: "Next example", exact: true }).click();
  await expect(page.locator(".op-preview")).toHaveAttribute("data-step", "4");
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "documents");
  await expect(page.locator("textarea")).toHaveValue("Ask which insurance document is accepted, then check the copy.");
  await expect(page.getByRole("button", { name: "Checklist note", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preview sample action" }).click();
  await page.getByRole("button", { name: "Confirm sample action" }).click();
  await page.getByRole("button", { name: "Next example", exact: true }).click();
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "letters");
  await page.getByRole("button", { name: "Explain date in the source", exact: true }).click();
  await expect(page.locator(".op-source-insight")).toContainText("not a general legal deadline");
  await page.getByRole("button", { name: "View highlighted source" }).click();
  await expect(page.locator("#source-letters-detail")).toBeFocused();
  await page.getByRole("button", { name: "Skip this example" }).click();
  await expect(page.locator(".op-preview")).toHaveAttribute("data-step", "5");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /^Example 1:/ }).click();
  await expect(page.locator(".op-action-copy")).toHaveText("Ask which insurance document is accepted, then check the copy.");
  await page.getByRole("button", { name: "Continue to tools" }).click();
  await page.getByRole("button", { name: "Connect later" }).click();
  await expect(page.locator(".op-plan")).toHaveCount(3);
  await expect(page.locator('[data-plan="letters"]')).toContainText("Skipped");
  await expect(page.locator('[data-plan="documents"]')).toContainText("Sample reviewed");
});

test("all six needs complete in order and each appears in the finished plan", async ({ page }) => {
  await toPriorities(page, "Arjun Mehta");
  for (const priority of priorities) await page.getByRole("checkbox", { name: new RegExp(`^${priority}`) }).press("Space");
  await advance(page);
  for (const [index, id] of ids.entries()) {
    await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", id);
    await expect(page.locator(".op-paper")).toHaveAttribute("data-paper-kind", id);
    await expect(page.locator(".op-journey-heading")).toContainText(`Example ${index + 1} of 6`);
    await confirmExample(page, `My reviewed ${id} next step.`);
    await page.getByRole("button", { name: index === 5 ? "Continue to tools" : "Next example", exact: true }).click();
  }
  await page.getByRole("button", { name: "Connect later" }).click();
  await expect(page.locator(".op-plan")).toHaveCount(6);
  for (const id of ids) {
    await expect(page.locator(`[data-plan="${id}"]`)).toContainText(`My reviewed ${id} next step.`);
    await expect(page.locator(`[data-plan="${id}"]`)).toContainText("Sample reviewed");
  }
  await page.getByRole("button", { name: "Open follow application updates example" }).click();
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "updates");
  await expect(page.locator(".op-action-copy")).toHaveText("My reviewed updates next step.");
});

test("selection reconciliation preserves remaining drafts, reorders main, and discards removed progress", async ({ page }) => {
  await toPriorities(page);
  for (const priority of priorities.slice(0, 3)) await page.getByRole("checkbox", { name: new RegExp(`^${priority}`) }).press("Space");
  await advance(page);
  await confirmExample(page, "Keep my letter draft.");
  await page.getByRole("button", { name: /^Example 2:/ }).click();
  await confirmExample(page, "Keep my document draft.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("checkbox", { name: /^Track deadlines/ }).press("Space");
  await page.getByRole("checkbox", { name: /^Prepare for appointments/ }).press("Space");
  await choose(page, "What matters most", "Prepare documents");
  await advance(page);
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "appointments");
  await page.getByRole("button", { name: /^Example 1:/ }).click();
  await expect(page.locator(".op-action-copy")).toHaveText("Keep my document draft.");
  await page.getByRole("button", { name: /^Example 2:/ }).click();
  await expect(page.locator(".op-action-copy")).toHaveText("Keep my letter draft.");
  await page.getByRole("button", { name: "Skip walkthrough" }).click();
  await page.getByRole("button", { name: "Connect later" }).click();
  await expect(page.locator('[data-plan="deadlines"]')).toHaveCount(0);
  await expect(page.locator('[data-plan="appointments"]')).toContainText("Skipped");
  await expect(page.locator('[data-plan="letters"]')).toContainText("Sample reviewed");
  await page.getByRole("button", { name: "Edit priorities" }).click();
  await page.getByRole("checkbox", { name: /^Track deadlines/ }).press("Space");
  await advance(page);
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "deadlines");
  await expect(page.getByRole("button", { name: "Explain this sample" })).toBeVisible();
});

test("mail and calendar choices are exclusive, independent, optional, and remain previews", async ({ page }) => {
  await toPriorities(page);
  await page.getByRole("checkbox", { name: /^Understand letters/ }).press("Space"); await advance(page);
  await page.getByRole("button", { name: "Skip walkthrough" }).click();
  await expect(page.locator(".op-tool")).toHaveCount(5);
  for (const excluded of ["Google Drive", "OneDrive", "Dropbox", "Todoist", "Telegram", "WhatsApp"]) await expect(page.locator(".op-tools")).not.toContainText(excluded);
  const select = async (name: string) => {
    await page.getByRole("button", { name: `Preview ${name} setup`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Permission preview", exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Select ${name} for setup`, exact: true }).click();
    await expect(page.getByRole("button", { name: `Remove ${name} selection`, exact: true })).toBeFocused();
  };
  await select("Gmail"); await select("Google Calendar"); await select("Microsoft Outlook");
  await expect(page.getByRole("button", { name: "Preview Gmail setup", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Google Calendar selection", exact: true })).toBeVisible();
  await select("Microsoft Calendar");
  await expect(page.getByRole("button", { name: "Preview Google Calendar setup", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview Apple Calendar setup", exact: true }).click();
  await expect(page.locator(".op-permissions")).toContainText("does not offer Apple sign-in");
  await expect(page.locator(".op-permissions input")).toHaveCount(0);
  await page.getByRole("button", { name: "Select Apple Calendar for setup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preview Microsoft Calendar setup", exact: true })).toBeVisible();
  await expect(page.getByText("Selected for setup", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "See my starting screen" }).click();
  await expect(page.locator(".op-summary")).toContainText("Microsoft Outlook, Apple Calendar selected for setup");
  await page.getByRole("button", { name: "Edit optional tools", exact: true }).click();
  await expect(page.getByText("Selected for setup", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Remove Apple Calendar selection", exact: true }).click();
  await expect(page.getByRole("button", { name: "Preview Apple Calendar setup", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Connect later", exact: true }).click();
  await expect(page.locator(".op-summary")).toContainText("Left for later");
});
