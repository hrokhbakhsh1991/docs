import { defineConfig, devices } from "@playwright/test";

/**
 * BQC — Denali tour creation + publication closure (desktop + mobile RTL).
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.operator.localhost:3000";

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["tour-creation-publication.spec.ts", "tour-creation-wizard-map.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: useExternalServers ? 300_000 : 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "OPERATOR_SMOKE_USE_DATABASE=0 node scripts/smoke-operator-e2e-servers.mjs",
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
