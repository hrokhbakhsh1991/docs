import { defineConfig, devices } from "@playwright/test";

const marketingBase = process.env.SESSION_SYNC_MARKETING_URL ?? "http://denali.localhost:3102";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["session-sync-regression.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    ...(process.env.SESSION_SYNC_BROWSER_CHANNEL
      ? { channel: process.env.SESSION_SYNC_BROWSER_CHANNEL }
      : {}),
    baseURL: marketingBase,
    navigationTimeout: 120_000,
    ...(process.env.SESSION_SYNC_HOST_RESOLVER_RULES
      ? {
          launchOptions: {
            args: [`--host-resolver-rules=${process.env.SESSION_SYNC_HOST_RESOLVER_RULES}`],
          },
        }
      : {}),
  },
  ...(process.env.SESSION_SYNC_MANAGED_SERVERS === "1"
    ? {
        webServer: [
          {
            command: "node scripts/session-sync-fault-proxy.mjs",
            url: "http://127.0.0.1:3004/__session_sync_test/health",
            reuseExistingServer: false,
            timeout: 30_000,
          },
          {
            command: "node scripts/smoke-marketing-e2e-servers.mjs",
            url: "http://127.0.0.1:3012/ready",
            reuseExistingServer: false,
            timeout: 720_000,
            env: {
              ...process.env,
              SMOKE_MARKETING_BASE_URL: marketingBase,
              SMOKE_PORTAL_PUBLIC_PORT: "3004",
              ALLOW_DENALI_WEB_PLUGIN: "true",
              ALLOW_URBAN_WEB_PLUGIN: "true",
            },
          },
        ],
      }
    : {}),
  reporter: [["list"]],
});
