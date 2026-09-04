import { defineConfig, devices } from "@playwright/test";

/**
 * WALLET-V1 closure — default Denali club + pilot Postgres E2E.
 */
const portalBaseUrl =
  process.env.SMOKE_DENALI_WALLET_V1_PORTAL_BASE_URL ??
  "http://portal.denali-wallet-pilot.localhost:3003";

function chromiumHostResolverArgs(): string[] {
  const rules = [
    "MAP portal.denali-wallet-pilot.localhost 127.0.0.1",
    "MAP portal.denali.localhost 127.0.0.1",
  ].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "denali-default-wallet-member-certification.spec.ts",
    "denali-default-wallet-engagement-dashboard.spec.ts",
    "denali-wallet-pilot-member-certification.spec.ts",
    "denali-wallet-engagement-dashboard.spec.ts",
    "denali-wallet-notification-browser.spec.ts",
  ],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 240_000,
  projects: [
    {
      name: "default-club-portal",
      testMatch: /denali-default-wallet-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://portal.denali.localhost:3003",
        viewport: { width: 1280, height: 900 },
        launchOptions: { args: chromiumHostResolverArgs() },
      },
    },
    {
      name: "pilot-portal",
      testMatch:
        /denali-wallet-pilot-.*\.spec\.ts|denali-wallet-engagement-dashboard\.spec\.ts|denali-wallet-notification-browser\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://portal.denali-wallet-pilot.localhost:3003",
        viewport: { width: 1280, height: 900 },
        launchOptions: { args: chromiumHostResolverArgs() },
      },
    },
  ],
  webServer: {
    command: "node ../../scripts/smoke-denali-wallet-pilot-servers.mjs",
    url: "http://127.0.0.1:3003/health",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
