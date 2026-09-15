import { defineConfig, devices } from "@playwright/test";

/**
 * PLP/PDP configurable field visibility — admin exposure → marketing catalog.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://denali.admin.localhost:3000";

const readinessUrl = `http://127.0.0.1:${process.env.PLP_PDP_SMOKE_READY_PORT ?? "3014"}/ready`;

function chromiumLaunchArgs(): string[] {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  return [
    `--host-resolver-rules=MAP denali.admin.localhost ${target},MAP denali.localhost ${target}`,
    "--disable-features=TrackingProtection3pcd,ThirdPartyStoragePartitioning",
    "--disable-web-security",
  ];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["plp-pdp-field-visibility.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumLaunchArgs() },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-plp-pdp-field-visibility-e2e-servers.mjs",
          url: readinessUrl,
          reuseExistingServer: false,
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
