import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing urban catalog smoke — SMK-MKT-05
 * @see docs/workspaces/denali/marketing-catalog-ui.md
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://urban.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-urban-catalog-smoke.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: marketingSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-marketing-urban-e2e-servers.mjs",
          url: `${marketingSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
