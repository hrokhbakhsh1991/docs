import { defineConfig, devices } from "@playwright/test";

/**
 * Operator gap audit — GAP-VIEWER/DASHBOARD/PLATFORM (Denali admin).
 */
const denaliOperatorBaseUrl =
  process.env.SMOKE_DENALI_WEB_BASE_URL ?? "http://denali.admin.localhost:3000";

const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["operator-gap-audit.browser.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: denaliOperatorBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-engagement-e2e-servers.mjs",
          url: `${denaliOperatorBaseUrl}/auth/login`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            DATABASE_URL:
              process.env.DATABASE_URL ??
              "postgresql://app_tour:app_tour@127.0.0.1:5432/app_tour_dev?connection_limit=32",
            DATABASE_URL_ADMIN:
              process.env.DATABASE_URL_ADMIN ??
              "postgresql://postgres:postgres@127.0.0.1:5432/app_tour_dev",
          },
        },
      }),
  reporter: [["list"]],
});
