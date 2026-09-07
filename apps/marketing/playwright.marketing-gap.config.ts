import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing catalog gap — GAP-MARKETING-01.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002";

function chromiumLaunchArgs(): string[] {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  const rules = [
    `MAP portal.denali.localhost ${target}`,
    `MAP denali.portal.localhost ${target}`,
    `MAP denali.localhost ${target}`,
  ].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-tours-catalog-gap.browser.spec.ts"],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
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
          url: `${marketingSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
