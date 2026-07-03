import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing SEO matrix smoke — SMK-MKT-14/15/104
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://operator.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "marketing-seo-unpublish.spec.ts",
    "marketing-seo-locale-matrix.spec.ts",
    "marketing-seo-sitemap-isolation.spec.ts",
  ],
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
          command: "node scripts/smoke-marketing-seo-matrix-e2e-servers.mjs",
          url: `${marketingSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
