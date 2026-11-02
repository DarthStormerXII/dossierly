import { defineConfig } from "@playwright/test";

const port = 3294;
const external = process.env.ONBOARDING_PREVIEW_BASE_URL;
export default defineConfig({
  testDir: ".", testMatch: "onboarding-preview*.spec.ts", timeout: 60_000, workers: 1, reporter: "list",
  use: { baseURL: external || `http://127.0.0.1:${port}`, trace: "off", screenshot: "off", video: "off" },
  webServer: external ? undefined : {
    cwd: process.cwd(), command: `node_modules/.bin/next dev --webpack --hostname 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}/onboarding-preview`, reuseExistingServer: false, timeout: 120_000,
  },
});
