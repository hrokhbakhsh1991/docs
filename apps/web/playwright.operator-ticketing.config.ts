import { defineConfig, devices } from "@playwright/test";

const operatorSmokeBaseUrl =
  process.env.SMOKE_OPERATOR_BASE_URL ?? "http://admin.operator.localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "operator-ticketing-inbox.spec.ts",
    "operator-ticket-templates-smoke.spec.ts",
    "operator-ticketing-reports-settings-smoke.spec.ts",
    "operator-ticketing-a11y.spec.ts",
  ],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: operatorSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  webServer: {
    command: "node scripts/smoke-operator-ticketing-e2e-servers.mjs",
    url: `${operatorSmokeBaseUrl}/auth/login`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
