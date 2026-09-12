import { defineConfig, devices } from "@playwright/test";

const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003";
const portalHealthUrl = process.env.SMOKE_PORTAL_HEALTH_URL ?? "http://127.0.0.1:3003/health";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["ticketing-ui-ux-screenshots.spec.ts"],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: 0,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  webServer: {
    command: "node scripts/smoke-portal-ticketing-e2e-servers.mjs",
    url: portalHealthUrl,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
