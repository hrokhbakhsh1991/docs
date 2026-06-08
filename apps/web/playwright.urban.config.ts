import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 8.4 — Urban product parity smoke (SMK-P8-01..04).
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["urban-e2e-integrity.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_WEB_BASE_URL ?? "http://urban.localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/smoke-urban-e2e-servers.mjs",
    url: process.env.SMOKE_WEB_BASE_URL ?? "http://urban.localhost:3000/",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
