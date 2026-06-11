import { defineConfig, devices } from "@playwright/test";

/**
 * Denali public catalog registration smoke — SMK-DREG-01
 * @see docs/workspaces/denali/public-catalog.md
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-catalog-registration.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.localhost:3003",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-denali-catalog-e2e-servers.mjs",
    url: `${process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.localhost:3003"}/health`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
