import { expect, test, type Page } from "@playwright/test";

async function checkPanel(page: Page, hasCode = false) {
  const layout = await page.locator(".auth-card").evaluate((card) => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, center: rect.left + rect.width / 2 };
    };
    const form = card.querySelector("form")!;
    const visible = [...form.children].filter((element) => element.getBoundingClientRect().height > 0);
    const group = card.querySelector(".otp-group");
    return {
      viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
      card: box(card), form: box(form), primary: box(form.querySelector('button[type="submit"]')!),
      rows: visible.map(box), controls: [...card.querySelectorAll("button, .field, .auth-legal, .auth-heading")].map(box),
      group: group && box(group), label: group && box(card.querySelector('label[for="auth-code"]')!),
      helper: group && box(card.querySelector("#code-help")!),
      helperAlign: group && getComputedStyle(card.querySelector("#code-help")!).textAlign,
      fieldAlign: group && getComputedStyle(card.querySelector(".auth-code-field")!).textAlign,
    };
  });
  expect(layout.overflow).toBe(false);
  expect(Math.abs(layout.card.center - layout.viewport / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.form.center - layout.primary.center)).toBeLessThanOrEqual(1);
  for (const box of layout.controls) {
    expect(box.left).toBeGreaterThanOrEqual(layout.card.left - 1);
    expect(box.right).toBeLessThanOrEqual(layout.card.right + 1);
  }
  for (let i = 1; i < layout.rows.length; i++) {
    expect(layout.rows[i].top - layout.rows[i - 1].bottom).toBeGreaterThanOrEqual(13);
  }
  if (hasCode) {
    for (const box of [layout.group, layout.label, layout.helper]) {
      expect(box).not.toBeNull();
      expect(Math.abs(box!.center - layout.form.center)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.center - layout.primary.center)).toBeLessThanOrEqual(1);
    }
    expect(layout.helperAlign).toBe("center");
    expect(layout.fieldAlign).toBe("center");
    await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(6);
  }
}

for (const width of [390, 820, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`auth panel stays centered at ${width}px in ${theme}, across form states`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.clock.install();
      let releaseRequest!: () => void;
      let releaseVerify!: () => void;
      const requestGate = new Promise<void>((resolve) => { releaseRequest = resolve; });
      const verifyGate = new Promise<void>((resolve) => { releaseVerify = resolve; });
      // These fixtures exercise layout only; no email is sent or session established.
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/auth/email/request") {
          await requestGate;
          return route.fulfill({ json: { challengeId: "layout-fixture", expiresIn: 600, resendAfter: 60 } });
        }
        if (path === "/api/auth/email/verify") {
          await verifyGate;
          return route.fulfill({ status: 400, json: { error: "Invalid code", code: "invalid_code" } });
        }
        return route.fulfill({ status: 401, json: { error: "Layout fixture has no session", code: "no_session" } });
      });
      await page.goto("/signin");
      await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
      await checkPanel(page);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText("Enter a valid email");
      await checkPanel(page);
      const email = `ananya.${"r".repeat(48)}@${"d".repeat(54)}.example.com`;
      await page.getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(page.getByRole("button", { name: "Sending your code…" })).toBeDisabled();
      await checkPanel(page);
      releaseRequest();
      const code = page.getByLabel("Six-digit code");
      await expect(code).toBeFocused();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await checkPanel(page, true);
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText("Enter the six-digit code");
      await checkPanel(page, true);
      await code.fill("012345");
      await page.getByRole("button", { name: "Verify and continue" }).click();
      await expect(page.getByRole("button", { name: "Signing you in…" })).toBeDisabled();
      await checkPanel(page, true);
      releaseVerify();
      await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText("That code didn’t match");
      await checkPanel(page, true);
      await page.clock.fastForward(601_000);
      await expect(code).toBeDisabled();
      await expect(page.locator("#code-help")).toContainText("This code has expired");
      await checkPanel(page, true);
    });
  }
}
