import { defineConfig, devices } from "@playwright/test";

const portalBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://portal.operator.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-wave-b-portal-evidence.spec.ts"],
  retries: 0,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalBaseUrl,
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 180_000,
  },
  reporter: [["list"]],
});
