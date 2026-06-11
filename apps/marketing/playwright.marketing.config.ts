import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing catalog smoke — SMK-MKT-01
 * @see docs/workspaces/denali/public-catalog.md
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-catalog-smoke.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_MARKETING_BASE_URL ?? "http://shop.operator.localhost:3002",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-marketing-e2e-servers.mjs",
    url: `${process.env.SMOKE_MARKETING_BASE_URL ?? "http://shop.operator.localhost:3002"}/health`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
