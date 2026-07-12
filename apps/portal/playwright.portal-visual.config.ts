import { defineConfig, devices } from "@playwright/test";

/**
 * Portal shell visual regression — SMK-PTL-VIS-01 (denali)
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const portalBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://denali.portal.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-shell-visual.spec.ts"],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 300_000,
  navigationTimeout: 180_000,
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalBaseUrl,
    viewport: { width: 1280, height: 900 },
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-portal-e2e-servers.mjs",
          url: `${portalBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
