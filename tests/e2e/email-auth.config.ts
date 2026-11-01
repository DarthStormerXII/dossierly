import { defineConfig } from "@playwright/test";

const port = 3293;
export default defineConfig({
  testDir: ".",
  testMatch: "email-auth.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "off", screenshot: "off", video: "off" },
  webServer: {
    cwd: process.cwd(),
    command: `node_modules/.bin/next dev --webpack --hostname 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}/signin`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MODELS_DISABLED: "1", NEBIUS_API_KEY: "", TAVILY_API_KEY: "", NVIDIA_API_KEY: "" },
  },
});
