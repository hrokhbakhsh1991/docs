import { defineConfig, devices } from "@playwright/test";

/**
 * MKP-001 — Denali operator marketing pages cross-surface smoke.
 */
const useExternalServers = process.env.PW_EXTERNAL_SERVERS === "1";

const denaliOperatorBaseUrl =
  process.env.SMOKE_DENALI_WEB_BASE_URL ?? "http://denali.admin.localhost:3000";

const readinessUrl = `http://127.0.0.1:${process.env.MKP_SMOKE_READY_PORT ?? "3015"}/ready`;

function chromiumLaunchArgs(): string[] {
  return [
    "--host-resolver-rules=MAP denali.admin.localhost 127.0.0.1,MAP denali.localhost 127.0.0.1",
    "--disable-features=TrackingProtection3pcd,ThirdPartyStoragePartitioning",
    "--disable-web-security",
  ];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["operator-marketing-pages-smoke.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: denaliOperatorBaseUrl,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
    launchOptions: { args: chromiumLaunchArgs() },
  },
  ...(useExternalServers
    ? {}
    : {
        webServer: {
          command: "node scripts/smoke-operator-marketing-pages-e2e-servers.mjs",
          url: readinessUrl,
          reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
          timeout: 720_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  reporter: [["list"]],
});
