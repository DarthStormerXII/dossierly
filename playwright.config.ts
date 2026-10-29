import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3217);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"], trace: "retain-on-failure" },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/status`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DEMO_FIXTURES: "1", NEBIUS_API_KEY: "", MODEL_PROVIDER: "tokenfactory" },
  },
});
