import { defineConfig, devices } from "@playwright/test";

import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "./tests/e2e/fixtures/smoke-published-tour";

/**
 * Marketing SEO smoke — SMK-MKT-06..09
 * @see docs/dev/guest-seo-e2e-hooks.yaml
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://operator.localhost:3002";

// SEO matrix seeds operator tenant …014 + tour …0210. Do not inherit the
// denali-default tour id (…0220) from resolveSmokePublishedTourId().
if (!process.env.SMOKE_PUBLISHED_TOUR_ID?.trim()) {
  process.env.SMOKE_PUBLISHED_TOUR_ID = OPERATOR_SMOKE_PUBLISHED_TOUR_ID;
}

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
  testMatch: ["marketing-seo-*.spec.ts"],
  retries: process.env.CI || process.env.PW_EXTERNAL_SERVERS === "1" ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: marketingSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    ...(stagingLaunchOptions() ? { launchOptions: stagingLaunchOptions() } : {}),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-marketing-seo-matrix-e2e-servers.mjs",
          url: `${marketingSmokeBaseUrl}/health`,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 360_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
