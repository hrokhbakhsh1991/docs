import { defineConfig, devices } from "@playwright/test";

/**
 * User portal registration smoke — SMK-PTL-01
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-registration-smoke.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-portal-e2e-servers.mjs",
    url: `${process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003"}/health`,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
