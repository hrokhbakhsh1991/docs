import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing harbor G1 **durable** smoke config (PSR-6c6b).
 * Seed path remains playwright.marketing-harbor.config.ts.
 *
 * Requires DATABASE_URL + DATABASE_URL_ADMIN; HARBOR_SMOKE_E2E_SEED unset.
 * Do not run without Architect YES + published tour fixtures.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://harbor.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-harbor-catalog-smoke.spec.ts"],
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
          command: "node scripts/smoke-marketing-harbor-durable-e2e-servers.mjs",
          url: `${marketingSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 420_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
