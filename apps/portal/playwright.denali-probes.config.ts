import { defineConfig, devices } from "@playwright/test";

/**
 * Probe-only Playwright config:
 * - does NOT change CI smoke selection (`playwright.portal.config.ts`)
 * - only runs Denali multi-guest probes (seed tour …000212)
 *
 * Run:
 *   cd apps/portal && pnpm exec playwright test -c playwright.denali-probes.config.ts
 */

const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.portal.localhost:3003";

function stagingLaunchOptions(): { args: string[] } | undefined {
  const vpsIp = process.env.VPS_IP?.trim();
  if (!useExternalServers || vpsIp === undefined || vpsIp.length === 0) {
    return undefined;
  }
  const rules = [
    `MAP operator.admin.localhost ${vpsIp}`,
    `MAP operator.portal.localhost ${vpsIp}`,
    `MAP portal.operator.localhost ${vpsIp}`,
    `MAP operator.localhost ${vpsIp}`,
  ].join(", ");
  return { args: [`--host-resolver-rules=${rules}`] };
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "denali-multi-guest-intake.spec.ts",
    "denali-multi-guest-partial-duplicate.spec.ts",
    "portal-registration-visual-denali.spec.ts",
  ],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    navigationTimeout: 180_000,
    ...(stagingLaunchOptions() ? { launchOptions: stagingLaunchOptions() } : {}),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-portal-e2e-servers.mjs",
          url: `${portalSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
