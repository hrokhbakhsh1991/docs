import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated prepayment create smoke.
 * This scenario verifies wizard pricing persistence and does not need the DB-backed finance stack.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://operator.admin.localhost:3000";

function stagingLaunchOptions(): { args: string[] } | undefined {
  const vpsIp = process.env.VPS_IP?.trim();
  if (!useExternalServers || vpsIp === undefined || vpsIp.length === 0) {
    return undefined;
  }
  const rules = [
    `MAP operator.admin.localhost ${vpsIp}`,
    `MAP operator.portal.localhost ${vpsIp}`,
    `MAP operator.localhost ${vpsIp}`,
  ].join(", ");
  return { args: [`--host-resolver-rules=${rules}`] };
}

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["denali-prepayment-create.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: useExternalServers ? 180_000 : 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
    ...(stagingLaunchOptions() ? { launchOptions: stagingLaunchOptions() } : {}),
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
