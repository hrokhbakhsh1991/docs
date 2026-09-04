import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 9.8 — Operator admin smoke (SMK-P9-01..09).
 * @see docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const OPERATOR_SMOKE_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.operator.localhost:3000";

function stagingLaunchOptions(): { args: string[] } | undefined {
  const vpsIp = process.env.VPS_IP?.trim();
  if (!useExternalServers || vpsIp === undefined || vpsIp.length === 0) {
    return undefined;
  }
  const rules = [
    `MAP admin.operator.localhost ${vpsIp}`,
    `MAP operator.admin.localhost ${vpsIp}`,
    `MAP operator.portal.localhost ${vpsIp}`,
    `MAP operator.localhost ${vpsIp}`,
  ].join(", ");
  return { args: [`--host-resolver-rules=${rules}`] };
}

export default defineConfig({
  globalSetup: useExternalServers ? undefined : "./tests/e2e/operator-smoke-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: [
    "operator-smoke.spec.ts",
    "denali-itinerary-wizard.spec.ts",
    "denali-finance-confidence.spec.ts",
    "denali-finance-ux2-browser-qa.spec.ts",
    "denali-workspace-finance-inbox.spec.ts",
    "denali-settings-route-matrix.spec.ts",
    "denali-booking-confidence.spec.ts",
    "denali-edit-confidence.spec.ts",
    "denali-clone-confidence.spec.ts",
    "p6-admin-publish-smoke.spec.ts",
    "p6-operator-receipt-approve-smoke.spec.ts",
    "p6-vertical-slice-browser-chain.spec.ts",
    "denali-workspace-approve-feedback.spec.ts",
    "scenario4-workspace-finance-actions.spec.ts",
    "scenario5-workspace-finance-submit-receipt.spec.ts",
    "scenario6-workspace-finance-under-review-gating.spec.ts",
  ],
  retries: process.env.CI || useExternalServers ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: useExternalServers ? 180_000 : 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: OPERATOR_SMOKE_BASE_URL,
    viewport: { width: 1280, height: 900 },
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    ...(stagingLaunchOptions() ? { launchOptions: stagingLaunchOptions() } : {}),
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-e2e-servers.mjs",
          // Wait for warmed login route — smoke script blocks until API + Next are ready.
          url: "http://127.0.0.1:3000/auth/login",
          reuseExistingServer:
            process.env.PW_NO_REUSE_SERVER !== "1" &&
            process.env.CI !== "true" &&
            process.env.CI !== "1",
          timeout: 300_000,
        },
      }),
  reporter: [["list"]],
});
