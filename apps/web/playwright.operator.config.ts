import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 9.8 — Operator admin smoke (SMK-P9-01..09).
 * @see docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./test/operator-smoke-global-setup.ts",
  testDir: "./test",
  testMatch: ["operator-smoke.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 1280, height: 900 },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-e2e-servers.mjs",
          // Wait for warmed login route — smoke script blocks until API + Next are ready.
          url: "http://127.0.0.1:3000/auth/login",
          reuseExistingServer:
            process.env.PW_NO_REUSE_SERVER !== "1" &&
            process.env.CI !== "true" &&
            process.env.CI !== "1",
          timeout: 300_000,
        },
      }),
  reporter: [["list"]],
});
