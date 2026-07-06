import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing shell visual regression — SMK-MKT-VIS-urban-01/02
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const urbanBaseUrl = process.env.SMOKE_MARKETING_BASE_URL ?? "http://urban.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-shell-visual-urban.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  snapshotPathTemplate: "{testDir}/{testFileName}-snapshots/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: urbanBaseUrl,
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
          command: "node scripts/smoke-marketing-urban-e2e-servers.mjs",
          url: `${urbanBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
