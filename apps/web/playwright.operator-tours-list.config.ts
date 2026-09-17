import { defineConfig, devices } from "@playwright/test";

const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const operatorBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.operator.localhost:3000";

function chromiumLaunchArgs(): string[] {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  const rules = [
    `MAP admin.operator.localhost ${target}`,
    `MAP operator.admin.localhost ${target}`,
    `MAP operator.localhost ${target}`,
    `MAP operator.portal.localhost ${target}`,
  ].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["operator-tours-list-admin.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: operatorBaseUrl,
    launchOptions: { args: chromiumLaunchArgs() },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-e2e-servers.mjs",
          url: "http://127.0.0.1:3000/auth/login",
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 300_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
});
