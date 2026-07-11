import { defineConfig, devices } from "@playwright/test";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://denali.admin.localhost:3000";

export default defineConfig({
  globalSetup: "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["custom-create-tours.spec.ts"],
  workers: 1,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-operator-e2e-servers.mjs",
    url: "http://127.0.0.1:3000/auth/login",
    reuseExistingServer: true,
    timeout: 300_000,
  },
  reporter: [["list"]],
});
