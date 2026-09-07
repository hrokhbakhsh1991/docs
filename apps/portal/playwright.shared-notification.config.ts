import { defineConfig, devices } from "@playwright/test";

const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "shared-notification-journeys-browser.spec.ts",
    "shared-notification-inbox-a11y.spec.ts",
  ],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
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
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://app_tour:app_tour@127.0.0.1:5432/app_tour_dev?connection_limit=32",
      DATABASE_URL_ADMIN:
        process.env.DATABASE_URL_ADMIN ??
        "postgresql://postgres:postgres@127.0.0.1:5432/app_tour_dev",
    },
  },
  reporter: [["list"]],
});
