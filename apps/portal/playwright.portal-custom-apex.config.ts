import { defineConfig, devices } from "@playwright/test";

/**
 * Custom apex PCMS smoke — SMK-PTL-08 on portal.denali.club
 * @see docs/standards/member-session-portal-authority.mdoc
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const portalCustomApexBaseUrl =
  process.env.SMOKE_PORTAL_CUSTOM_APEX_BASE_URL ?? "http://portal.denali.club:3003";

function customApexLaunchOptions(): { args: string[] } {
  const vpsIp = process.env.VPS_IP?.trim();
  const hostRules =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0
      ? [
          `MAP portal.denali.club ${vpsIp}`,
          `MAP denali.club ${vpsIp}`,
          `MAP admin.denali.club ${vpsIp}`,
        ]
      : [
          "MAP portal.denali.club 127.0.0.1",
          "MAP denali.club 127.0.0.1",
          "MAP admin.denali.club 127.0.0.1",
        ];
  return { args: [`--host-resolver-rules=${hostRules.join(", ")}`] };
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-custom-apex-pcms-smoke.spec.ts"],
  globalSetup: "./tests/e2e/portal-custom-apex-smoke-global-setup.ts",
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalCustomApexBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 240_000,
    launchOptions: customApexLaunchOptions(),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-portal-e2e-servers.mjs",
          url: "http://127.0.0.1:3003/health",
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            SMOKE_PORTAL_BASE_URL: portalCustomApexBaseUrl,
            MARKETING_PUBLIC_BASE_URL: "http://denali.club:3002",
          },
        },
      }),
  reporter: [["list"]],
});
