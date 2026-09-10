import { defineConfig, devices } from "@playwright/test";

/**
 * WALLET-P3C — wallet-ws1 member portal certification (Postgres).
 */
const portalBaseUrl =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://portal.wallet-ws1.localhost:3003";

function chromiumHostResolverArgs(): string[] {
  const rules = ["MAP portal.wallet-ws1.localhost 127.0.0.1"].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["wallet-ws1-member-certification.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: portalBaseUrl,
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumHostResolverArgs() },
  },
  webServer: {
    command: "node ../../scripts/smoke-wallet-ws1-certification-servers.mjs",
    url: "http://127.0.0.1:3003/health",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
