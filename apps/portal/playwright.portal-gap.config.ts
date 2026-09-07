import { defineConfig, devices } from "@playwright/test";

/**
 * Portal guest home gap — GAP-PORTAL-01.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://denali.portal.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-home-gap.browser.spec.ts"],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-portal-gap-e2e-servers.mjs",
          url: "http://127.0.0.1:3003/health",
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
