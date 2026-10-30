import { defineConfig } from "@playwright/test";

// Live production checks against https://dossierly.pages.dev. Run: npx playwright test -c tests/live/playwright.live.config.ts
export default defineConfig({
  testDir: ".",
  testMatch: "*.live.ts",
  timeout: 420_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: process.env.LIVE_OUT ?? "test-results/live-artifacts",
  use: { baseURL: "https://dossierly.pages.dev", browserName: "chromium", headless: true, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", testIgnore: /wide\.live\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "wide", testMatch: /wide\.live\.ts/, use: { viewport: { width: 1280, height: 800 } } },
  ],
});
