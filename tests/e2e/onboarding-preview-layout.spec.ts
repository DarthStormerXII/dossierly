import { expect, test } from "@playwright/test";
import { advance, checkGeometry, choose } from "./onboarding-preview.helpers";

for (const width of [390, 820, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`all six screens align at ${width}px in ${theme}, including menus and long content`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/onboarding-preview");
      await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
      await checkGeometry(page);
      await advance(page);
      await expect(page.locator(".op-preview").getByRole("alert")).toBeVisible();
      await checkGeometry(page);
      await page.getByLabel("Full name").fill("Ananya Rao Srinivasan Nguyễn de la Cruz Fernández-López".repeat(2).slice(0, 100));
      await page.getByRole("button", { name: /Your preferred first language/ }).click();
      const menu = await page.getByRole("listbox").boundingBox();
      expect(menu!.x).toBeGreaterThanOrEqual(0);
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(width);
      expect(menu!.y).toBeGreaterThanOrEqual(0);
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(900);
      await page.getByRole("option", { name: "தமிழ் · Tamil", exact: true }).click();
      await advance(page);
      await page.getByRole("radio", { name: "Family", exact: true }).check();
      await choose(page, "Where are you in the process", "Waiting for a decision");
      await page.getByLabel(/City in Poland/).fill("Gorzów Wielkopolski / Bielsko-Biała — still deciding where to settle");
      await page.getByLabel(/Office handling/).fill("Mazowieckie Voivodeship Office, Department for Foreigners — application information and correspondence");
      await checkGeometry(page);
      await advance(page);
      await checkGeometry(page);
      await page.getByRole("checkbox", { name: /^Understand letters/ }).press("Space");
      await page.getByRole("checkbox", { name: /^Communicate with the office/ }).press("Space");
      await checkGeometry(page);
      await advance(page);
      await checkGeometry(page);
      await page.getByRole("button", { name: "Explain this sample" }).click();
      await checkGeometry(page);
      await page.locator("textarea").fill("Review the original with my adviser. ".repeat(16));
      await page.getByRole("button", { name: "Preview sample action" }).click();
      await checkGeometry(page);
      await page.getByRole("button", { name: "Confirm sample action" }).click();
      await checkGeometry(page);
      await expect(page.getByText("ஒரு நேரத்தில் ஒரு படி.", { exact: true })).toBeVisible();
      await advance(page);
      await checkGeometry(page);
      await page.getByRole("button", { name: "Preview Gmail setup" }).click();
      await checkGeometry(page);
      await page.getByRole("button", { name: "Select Gmail for setup" }).click();
      await page.getByRole("button", { name: "Preview Google Calendar setup" }).click();
      await checkGeometry(page);
      await page.getByRole("button", { name: "Select Google Calendar for setup" }).click();
      await page.getByRole("button", { name: "See my starting screen" }).click();
      await expect(page.locator(".op-preview")).toHaveAttribute("data-step", "6");
      await checkGeometry(page);
      await expect(page.getByText(/No account, case or connection has been created/)).toBeVisible();
    });
  }
}
