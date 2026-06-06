import { defineConfig, devices } from "@playwright/test";

/**
 * TH-1 e2e — tenant theme isolation (Phase 4.4).
 * @see docs/phase-4/appendices/th-1-playwright-e2e.md
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node scripts/th1-e2e-servers.mjs",
    cwd: __dirname,
    url: "http://127.0.0.1:3000/",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 180_000,
  },
  reporter: [["list"]],
});
