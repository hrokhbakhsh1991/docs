import { defineConfig, devices } from "@playwright/test";

/**
 * Portal E2E smoke — SMK-PTL-01..07 (+ DEN-PROF in profile spec)
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const portalSmokeBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://portal.operator.localhost:3003";
const chromiumExecutablePath = process.env.PW_CHROMIUM_EXECUTABLE_PATH?.trim();

function hostResolverLaunchOptions(): { args: string[] } {
  const vpsIp = process.env.VPS_IP?.trim();
  const target =
    useExternalServers && vpsIp !== undefined && vpsIp.length > 0 ? vpsIp : "127.0.0.1";
  const rules = [
    `MAP admin.operator.localhost ${target}`,
    `MAP admin.denali.localhost ${target}`,
    `MAP operator.admin.localhost ${target}`,
    `MAP operator.portal.localhost ${target}`,
    `MAP portal.operator.localhost ${target}`,
    `MAP operator.localhost ${target}`,
    `MAP denali.club ${target}`,
    `MAP portal.denali.club ${target}`,
  ].join(", ");
  return { args: [`--host-resolver-rules=${rules}`] };
}

function portalLaunchOptions(): {
  readonly args?: string[];
  readonly executablePath?: string;
} {
  return {
    ...hostResolverLaunchOptions(),
    ...(chromiumExecutablePath === undefined ? {} : { executablePath: chromiumExecutablePath }),
  };
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "portal-registration-smoke.spec.ts",
    "portal-registration-resume-smoke.spec.ts",
    "portal-member-profile-smoke.spec.ts",
    "portal-member-smoke.spec.ts",
    "portal-profile-ssr-cookie-fix.spec.ts",
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
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    navigationTimeout: 180_000,
    launchOptions: portalLaunchOptions(),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "PORTAL_SMOKE_WITH_ADMIN=1 node scripts/smoke-portal-e2e-servers.mjs",
          url: `${portalSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
