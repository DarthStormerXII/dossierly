import { test, expect, type Page } from "@playwright/test";
import { emptyFinish, mocks, resetMetadata, sampleFacts } from "./onboarding-real.helpers";
async function bounds(page: Page, width: number) {
  await expect(page.locator("main")).toBeVisible();
  const size = await page.evaluate(() => {
    const main = document.querySelector(".op-shell")!; const r = main.getBoundingClientRect();
    return { scroll: document.documentElement.scrollWidth, viewport: innerWidth, left: r.left, right: r.right, center: (r.left + r.right) / 2 };
  });
  expect(size.scroll).toBeLessThanOrEqual(width + 1); expect(size.left).toBeGreaterThanOrEqual(0); expect(size.right).toBeLessThanOrEqual(width + 1); expect(Math.abs(size.center - width / 2)).toBeLessThan(2);
}
for (const width of [390, 820, 1440]) for (const theme of ["light", "dark"] as const) {
  test(`six setup screens, paper and chat bounds at ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await resetMetadata(page); await mocks(page); const writes: unknown[] = [];
    page.on("request", (request) => { if (request.url().endsWith("/api/onboarding") && request.method() === "POST") writes.push(request.postDataJSON()); });
    await page.goto("/onboarding"); await expect(page.getByLabel("Full name")).toBeVisible(); await bounds(page, width);
    await page.getByLabel("Full name").fill("Anika Raman With A Long Family Name");
    await page.getByRole("button", { name: /Your preferred first language/ }).click(); await expect(page.getByRole("listbox")).toBeVisible(); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Continue →" }).click(); await page.getByRole("radio", { name: "Work", exact: true }).press("Space");
    await page.getByRole("button", { name: /Where are you in the process/ }).click(); await page.getByRole("option", { name: "Preparing an application", exact: true }).click(); await bounds(page, width);
    await page.getByRole("button", { name: "Continue →" }).click(); await page.getByRole("checkbox", { name: /Understand letters/ }).press("Space"); await bounds(page, width);
    await page.getByRole("button", { name: "Continue →" }).click(); await sampleFacts(page); await bounds(page, width);
    const paper = await page.locator(".ob-original").evaluate((node) => ({ background: getComputedStyle(node).backgroundColor, imageWidth: node.querySelector("img")!.getBoundingClientRect().width, textSize: parseFloat(getComputedStyle(document.querySelector(".ob-transcript p")!).fontSize) }));
    expect(paper.background).toBe("rgb(255, 255, 255)"); expect(paper.imageWidth).toBeGreaterThanOrEqual(680); expect(paper.textSize).toBeGreaterThanOrEqual(16);
    if (width === 1440) { const panes = await page.locator(".op-workbench").evaluate((node) => Array.from(node.children).map((child) => child.getBoundingClientRect().width)); expect(panes[0]).toBeGreaterThan(500); expect(panes[1]).toBeGreaterThan(380); }
    await page.getByRole("button", { name: "Skip this priority for now" }).click(); await page.getByRole("button", { name: "Continue to optional tools" }).click(); await expect(page.getByRole("button", { name: "Set up Gmail", exact: true })).toBeDisabled(); await bounds(page, width);
    for (const logo of await page.locator(".op-tool-logo").all()) { await logo.scrollIntoViewIfNeeded(); await expect.poll(() => logo.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); }
    const images = await page.locator(".op-tool-logo").evaluateAll((nodes) => nodes.map((node) => ({ loaded: (node as HTMLImageElement).naturalWidth, w: node.getBoundingClientRect().width, h: node.getBoundingClientRect().height, fit: getComputedStyle(node).objectFit })));
    expect(images).toHaveLength(5); for (const item of images) { expect(item.loaded).toBeGreaterThan(0); expect(item.w).toBe(item.h); expect(item.fit).toBe("contain"); }
    await page.getByRole("button", { name: "Review my setup" }).click(); await expect(page.getByRole("heading", { name: "You explored a fictional case" })).toBeVisible(); await bounds(page, width);
    await page.getByRole("button", { name: "Start my own case", exact: true }).click(); await emptyFinish(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.getByLabel("Your question", { exact: true }).fill("A long question about the information in my case. ".repeat(15)); await page.getByRole("button", { name: "Review question", exact: true }).click(); await expect(page.getByRole("button", { name: "Send question", exact: true })).toBeVisible();
    expect(JSON.stringify(writes)).not.toContain("Anika"); expect(JSON.stringify(writes)).not.toContain("transcript");
  });
}
