import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.SMOKE_DENALI_DEFAULT_WALLET_PORTAL_BASE_URL ??
  "http://portal.denali.localhost:3003";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-member-execution-summary.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  webServer: {
    command: "node scripts/smoke-portal-ito-e2e-servers.mjs",
    url: "http://127.0.0.1:3003/health",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
