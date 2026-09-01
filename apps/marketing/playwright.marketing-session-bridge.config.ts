import { defineConfig, devices } from "@playwright/test";

/**
 * Marketing ↔ Portal session bridge (REG-MKT-PTL-*) — operator smoke hosts.
 * Canonical repro: operator.localhost + portal.operator.localhost (PCMS / DG-4.7.2).
 */
const marketingSmokeBaseUrl =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://operator.localhost:3002";
const marketingReadinessUrl = `http://127.0.0.1:${process.env.MARKETING_SMOKE_READY_PORT ?? "3012"}/ready`;

function chromiumLaunchArgs(): string[] {
  const rules = [
    "MAP portal.denali.localhost 127.0.0.1",
    "MAP denali.portal.localhost 127.0.0.1",
    "MAP denali.localhost 127.0.0.1",
    "MAP operator.admin.localhost 127.0.0.1",
    "MAP operator.portal.localhost 127.0.0.1",
    "MAP portal.operator.localhost 127.0.0.1",
    "MAP operator.localhost 127.0.0.1",
  ].join(", ");
  return [
    `--host-resolver-rules=${rules}`,
    "--disable-features=TrackingProtection3pcd,ThirdPartyStoragePartitioning",
    "--disable-web-security",
  ];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-portal-session-bridge.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: marketingSmokeBaseUrl,
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumLaunchArgs() },
  },
  webServer: {
    command: "node scripts/smoke-marketing-e2e-servers.mjs",
    url: marketingReadinessUrl,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SMOKE_MARKETING_BASE_URL: marketingSmokeBaseUrl,
    },
  },
  reporter: [["list"]],
});
