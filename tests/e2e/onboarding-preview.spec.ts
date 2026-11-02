import { expect, test } from "@playwright/test";
import { advance, choose, toExample, toPriorities } from "./onboarding-preview.helpers";

test("validates forgiving details, supports keyboard menus, and preserves answers on Back", async ({ page }) => {
  await page.goto("/onboarding-preview");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Where are you settling/ })).toBeDisabled();
  await advance(page);
  await expect(page.locator(".op-preview").getByRole("alert")).toContainText("Enter the name");
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill("  Ananya  ");
  const language = page.getByRole("button", { name: /Your preferred first language/ });
  await language.press("Enter");
  await expect(page.getByRole("option")).toHaveCount(8);
  await page.getByRole("listbox").press("End");
  await page.getByRole("listbox").press("Enter");
  await expect(language).toContainText("Tiếng Việt");
  await expect(language).toBeFocused();
  await advance(page);
  await expect(page.locator("#op-title")).toBeFocused();
  await advance(page);
  await expect(page.locator(".op-preview").getByRole("alert")).toContainText("Choose what brings you");
  await page.getByRole("radio", { name: "Study", exact: true }).check();
  await advance(page);
  await expect(page.locator(".op-preview").getByRole("alert")).toContainText("Choose your current stage");
  await choose(page, "Where are you in the process", "Planning to move");
  await expect(page.getByLabel(/Office handling/)).toHaveCount(0);
  await choose(page, "Where are you in the process", "Waiting for a decision");
  await page.getByLabel(/Office handling/).fill("Mazowieckie Voivodeship Office");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("  Ananya  ");
  await expect(language).toContainText("Tiếng Việt");
  await advance(page);
  await expect(page.getByRole("radio", { name: "Study", exact: true })).toBeChecked();
  await expect(page.getByLabel(/Office handling/)).toHaveValue("Mazowieckie Voivodeship Office");
  await advance(page);
  await expect(page.locator("#op-title")).toHaveText("What would make things easier?");
});

test("main priority stays within selected needs, including removal and empty selection", async ({ page }) => {
  await toPriorities(page);
  await advance(page);
  await expect(page.locator(".op-preview").getByRole("alert")).toContainText("Choose at least one");
  const letters = page.getByRole("checkbox", { name: /^Understand letters/ });
  const deadlines = page.getByRole("checkbox", { name: /^Track deadlines/ });
  await letters.press("Space"); await deadlines.press("Space");
  const main = page.getByRole("button", { name: /What matters most right now/ });
  await expect(main).toContainText("Understand letters");
  await main.click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option", { name: "Track deadlines", exact: true }).click();
  await deadlines.press("Space");
  await expect(main).toContainText("Understand letters");
  await letters.press("Space");
  await expect(main).toHaveCount(0);
  await expect(page.getByText("Choose at least one kind of help to shape your example.")).toBeVisible();
  await deadlines.press("Space"); await advance(page);
  await expect(page.locator(".op-walkthrough")).toHaveAttribute("data-demo", "deadlines");
});

const scenarios = [
  ["Understand letters", "A letter asking for one more document", "Date in the source"],
  ["Prepare documents", "A checklist with one item to clarify", "Item to clarify"],
  ["Track deadlines", "A date worth keeping in view", "Date in the source"],
  ["Prepare for appointments", "A calmer first office visit", "Visit detail"],
  ["Communicate with the office", "A clear question for the office", "Phrase in the source"],
  ["Follow application updates", "An update, without the guesswork", "Status in the source"],
];
for (const [priority, title, evidence] of scenarios) {
  test(`${priority} opens its own reviewable sample`, async ({ page }) => {
    await toExample(page, priority);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Explain this sample" }).click();
    await expect(page.getByRole("heading", { name: "In plain language" })).toBeFocused();
    await expect(page.locator("mark[data-highlighted=true]")).toBeVisible();
    await expect(page.getByText(evidence, { exact: true })).toBeVisible();
    await page.locator("textarea").fill("");
    await page.getByRole("button", { name: "Preview sample action" }).click();
    await expect(page.locator(".op-preview").getByRole("alert")).toContainText("Add a sample next step");
    const draft = `My sample plan: review the ${priority.toLowerCase()} example with a friend.`;
    await page.locator("textarea").fill(draft);
    await page.getByRole("button", { name: "Preview sample action" }).click();
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit sample action" }).click();
    await expect(page.locator("textarea")).toHaveValue(draft);
    await page.getByRole("button", { name: "Preview sample action" }).click();
    await page.getByRole("button", { name: "Confirm sample action" }).click();
    await expect(page.getByText("Sample confirmed", { exact: true })).toBeVisible();
    await advance(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    await expect(page.getByText("Sample confirmed", { exact: true })).toBeVisible();
  });
}

test("full preview makes no API, external, write, storage or popup side effects and restarts cleanly", async ({ page, baseURL }) => {
  const unsafe: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method())) unsafe.push(request.method() + " " + url.pathname);
    if (url.origin !== new URL(baseURL!).origin) unsafe.push("external request");
  });
  let popups = 0; page.on("popup", () => { popups++; });
  await toExample(page, "Prepare documents");
  await page.getByRole("button", { name: "Skip example" }).click();
  await page.getByRole("button", { name: "Preview Gmail setup" }).click();
  await expect(page.getByText("Permission preview", { exact: true })).toBeVisible();
  await expect(page.getByText(/cannot read or send email/)).toBeVisible();
  await page.getByRole("button", { name: "Select Gmail for setup" }).click();
  await expect(page.getByRole("button", { name: "Remove Gmail selection" })).toBeFocused();
  await page.getByRole("button", { name: "Preview Google Calendar setup" }).click();
  await page.getByRole("button", { name: "Select Google Calendar for setup" }).click();
  await expect(page.getByText("Selected for setup", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Connected", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "See my starting screen" }).click();
  await expect(page.getByRole("heading", { name: "A place to start, Ananya Rao" })).toBeVisible();
  await expect(page.getByText("Gmail and Google Calendar selected for setup", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try the sample" }).click();
  await expect(page.getByRole("heading", { name: "A checklist with one item to clarify" })).toBeVisible();
  await page.getByRole("button", { name: "Skip example" }).click();
  await page.getByRole("button", { name: "Remove Gmail selection" }).click();
  await expect(page.getByRole("button", { name: "Preview Gmail setup" })).toBeFocused();
  await page.getByRole("button", { name: "Connect later" }).click();
  await expect(page.getByText("Left for later", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(unsafe).toEqual([]); expect(popups).toBe(0);
  await page.getByRole("button", { name: "Restart preview" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect(page.getByRole("button", { name: /Your preferred first language/ })).toContainText("English");
  await page.getByLabel("Full name").fill("Minh Nguyễn"); await advance(page);
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect(page.locator(".op-progress")).toHaveAttribute("aria-label", "Step 1 of 5: Your details");
});
