import { defineConfig, devices } from "@playwright/test";

const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-member-tickets-smoke.spec.ts"],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  webServer: {
    command: "node scripts/smoke-portal-ticketing-e2e-servers.mjs",
    url: `${portalSmokeBaseUrl}/health`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
