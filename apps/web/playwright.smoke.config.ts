import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 6.6 — Denali smoke (SMK-P6-01..06).
 * @see docs/phase-6/appendices/SMOKE-SCENARIO-MAP.md
 */
export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: ["**/*.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_BASE_URL ?? "http://denali.localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-denali-e2e-servers.mjs",
    url: "http://denali.localhost:3000/",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 240_000,
  },
  reporter: [["list"]],
});
