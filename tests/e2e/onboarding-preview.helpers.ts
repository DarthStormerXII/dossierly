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
export async function confirmExample(page: Page, draft?: string) {
  await page.getByRole("button", { name: "Explain this sample", exact: true }).click();
  if (draft) await page.locator("textarea").fill(draft);
  await page.getByRole("button", { name: "Preview sample action", exact: true }).click();
  await page.getByRole("button", { name: "Confirm sample action", exact: true }).click();
}
export async function checkGeometry(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const geometry = await page.locator(".op-shell").evaluate((shell) => {
    const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, center: r.left + r.width / 2, top: r.top, bottom: r.bottom }; };
    const paper = shell.querySelector(".op-paper");
    const panes = [...shell.querySelectorAll(".op-workbench > *")].map(rect);
    const form = shell.querySelector(".op-form");
    const context = shell.querySelector(".op-context");
    const primary = shell.querySelector(".op-navigation > .btn");
    const footer = shell.querySelector(".op-navigation");
    return {
      width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, shell: rect(shell), panes,
      form: form && rect(form), context: context && rect(context), wide: !!paper,
      primary: primary && rect(primary), footer: footer && rect(footer),
      paper: paper && { ...rect(paper), font: parseFloat(getComputedStyle(paper).fontSize), background: getComputedStyle(paper).backgroundColor, color: getComputedStyle(paper).color },
      bounds: [...shell.querySelectorAll(".field, .op-paper, .op-choice, .op-permissions, textarea, .op-action-review, .op-summary, .op-plan, .op-chat, .op-composer, .op-question-review, .op-chat-user, .op-chat-response")].map(rect),
    };
  });
  expect(geometry.overflow).toBe(false);
  expect(Math.abs(geometry.shell.center - geometry.width / 2)).toBeLessThanOrEqual(1);
  if (geometry.primary && geometry.footer) expect(Math.abs(geometry.primary.center - geometry.footer.center)).toBeLessThanOrEqual(1);
  for (const item of geometry.bounds) {
    expect(item.left).toBeGreaterThanOrEqual(geometry.shell.left - 1);
    expect(item.right).toBeLessThanOrEqual(geometry.shell.right + 1);
  }
  if (geometry.paper) {
    expect(geometry.paper.font).toBeGreaterThanOrEqual(15);
    expect(geometry.paper.background).toBe("rgb(255, 255, 255)");
    expect(geometry.paper.color).toBe("rgb(37, 37, 37)");
    if (geometry.width >= 1000) {
      expect(geometry.shell.width).toBeGreaterThan(1100);
      expect(geometry.panes[0].width).toBeGreaterThan(650);
      expect(geometry.panes[1].width).toBeGreaterThan(450);
      expect(geometry.panes[1].left - geometry.panes[0].right).toBeGreaterThanOrEqual(32);
      expect(Math.abs(geometry.panes[0].top - geometry.panes[1].top)).toBeLessThanOrEqual(1);
    } else expect(geometry.panes[1].top - geometry.panes[0].bottom).toBeGreaterThanOrEqual(24);
  } else if (geometry.width >= 1000 && geometry.form && geometry.context) {
    expect(geometry.form.width).toBeGreaterThan(500);
    expect(geometry.form.left - geometry.context.right).toBeGreaterThan(48);
  }
}
