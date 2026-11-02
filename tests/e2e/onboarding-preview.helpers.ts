import { expect, type Page } from "@playwright/test";

export const advance = (page: Page) => page.getByRole("button", { name: "Continue", exact: true }).click();
export async function choose(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
export async function toPriorities(page: Page, name = "Ananya Rao") {
  await page.goto("/onboarding-preview");
  await page.getByLabel("Full name").fill(name);
  await advance(page);
  await page.getByRole("radio", { name: "Work", exact: true }).check();
  await choose(page, "Where are you in the process", "Preparing an application");
  await page.getByLabel(/City in Poland/).fill("Warsaw");
  await advance(page);
}
export async function toExample(page: Page, priority = "Understand letters") {
  await toPriorities(page);
  await page.getByRole("checkbox", { name: new RegExp(`^${priority}`) }).press("Space");
  await advance(page);
}
export async function checkGeometry(page: Page) {
  const geometry = await page.locator(".op-shell").evaluate((shell) => {
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, center: r.left + r.width / 2, top: r.top, bottom: r.bottom }; };
    const form = shell.querySelector(".op-form, .op-start")!;
    return {
      width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, shell: rect(shell),
      centered: [...shell.querySelectorAll(".op-heading, .op-progress, .op-form, .op-start, .op-navigation > .btn, .op-first-action > .btn")].map(rect),
      bounds: [...shell.querySelectorAll(".field, .op-source, .op-choice, .op-permissions, textarea, .op-action-review, .op-summary, .op-first-action, .op-plan")].map(rect),
      rows: [...form.children].filter((element) => element.getBoundingClientRect().height > 0).map(rect),
    };
  });
  expect(geometry.overflow).toBe(false);
  expect(Math.abs(geometry.shell.center - geometry.width / 2)).toBeLessThanOrEqual(1);
  for (const item of geometry.centered) expect(Math.abs(item.center - geometry.shell.center)).toBeLessThanOrEqual(1);
  for (const item of geometry.bounds) {
    expect(item.left).toBeGreaterThanOrEqual(geometry.shell.left - 1);
    expect(item.right).toBeLessThanOrEqual(geometry.shell.right + 1);
  }
  for (let i = 1; i < geometry.rows.length; i++) expect(geometry.rows[i].top - geometry.rows[i - 1].bottom).toBeGreaterThanOrEqual(20);
}
