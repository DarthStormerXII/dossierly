import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "onboarding-real*.spec.ts", timeout: 90_000, workers: 1, reporter: "list",
  use: { actionTimeout: 15_000, baseURL: process.env.ONBOARDING_REAL_BASE_URL || "http://127.0.0.1:3295", storageState: process.env.ONBOARDING_REAL_STORAGE_STATE, trace: "off", screenshot: "off", video: "off" },
});
