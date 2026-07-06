import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing shell visual regression — SMK-MKT-VIS-guest-01/02
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const guestClubBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://guest-club.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-shell-visual-guest-club.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: guestClubBaseUrl,
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
          command: "node scripts/smoke-marketing-guest-club-e2e-servers.mjs",
          url: `${guestClubBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
