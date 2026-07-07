import { defineConfig, devices } from "@playwright/test";

/**
 * Portal E2E smoke — SMK-PTL-01..07 (+ DEN-PROF in profile spec)
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
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
    `MAP operator.localhost ${vpsIp}`,
  ].join(", ");
  return { args: [`--host-resolver-rules=${rules}`] };
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "portal-registration-smoke.spec.ts",
    "portal-registration-resume-smoke.spec.ts",
    "portal-member-profile-smoke.spec.ts",
    "portal-member-smoke.spec.ts",
  ],
  globalSetup: "./tests/e2e/portal-smoke-global-setup.ts",
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
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
