import { defineConfig, devices } from "@playwright/test";

/**
 * BQC — Tour creation closure (operator + marketing + portal + isolation).
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.operator.localhost:3000";

const readinessUrl = `http://127.0.0.1:${process.env.TOUR_CLOSURE_SMOKE_READY_PORT ?? "3016"}/ready`;

function chromiumLaunchArgs(): string[] {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  const rules = [
    `MAP admin.operator.localhost ${target}`,
    `MAP operator.admin.localhost ${target}`,
    `MAP operator.localhost ${target}`,
    `MAP operator.portal.localhost ${target}`,
    `MAP portal.operator.localhost ${target}`,
    `MAP denali.admin.localhost ${target}`,
  ].join(", ");
  return [
    `--host-resolver-rules=${rules}`,
    "--disable-features=TrackingProtection3pcd,ThirdPartyStoragePartitioning",
    "--disable-web-security",
  ];
}

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["tour-creation-closure.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 360_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumLaunchArgs() },
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-tour-creation-closure-e2e-servers.mjs",
          url: readinessUrl,
          reuseExistingServer: process.env.PW_NO_REUSE_SERVER !== "1" && !process.env.CI,
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
