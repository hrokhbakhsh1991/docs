import { defineConfig, devices } from "@playwright/test";

/**
 * P1 EPIC H — Platform Control Center E2E (create club + owner handoff).
 * @see docs/phase-15/platform-control-center-ui.mdoc
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./test/e2e/platform-smoke-global-setup.ts",
  testDir: "./test/e2e",
  testMatch: [
    "platform-owner-handoff.spec.ts",
    "platform-create-club.spec.ts",
    "platform-suspend-blocks-login.spec.ts",
    "platform-ops-ui.spec.ts",
    "platform-team-invite.spec.ts",
  ],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-platform-e2e-servers.mjs",
          url: "http://admin.localhost:3000/auth/login",
          reuseExistingServer:
            process.env.PW_NO_REUSE_SERVER !== "1" &&
            process.env.CI !== "true" &&
            process.env.CI !== "1",
          timeout: 360_000,
        },
      }),
  reporter: [["list"]],
});
