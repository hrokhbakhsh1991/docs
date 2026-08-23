import { defineConfig, devices } from "@playwright/test";

const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002";
const marketingReadinessUrl = `http://127.0.0.1:${process.env.MARKETING_SMOKE_READY_PORT ?? "3012"}/ready`;

function chromiumLaunchArgs(): string[] {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  const rules = [
    `MAP portal.denali.localhost ${target}`,
    `MAP denali.portal.localhost ${target}`,
    `MAP denali.localhost ${target}`,
    `MAP operator.admin.localhost ${target}`,
    `MAP operator.portal.localhost ${target}`,
    `MAP portal.operator.localhost ${target}`,
    `MAP operator.localhost ${target}`,
  ].join(", ");
  return [
    `--host-resolver-rules=${rules}`,
    "--disable-features=TrackingProtection3pcd,ThirdPartyStoragePartitioning",
    "--disable-web-security",
  ];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["prod7-accessibility-smoke.spec.ts"],
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 420_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: marketingSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumLaunchArgs() },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-marketing-e2e-servers.mjs",
          url: marketingReadinessUrl,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
