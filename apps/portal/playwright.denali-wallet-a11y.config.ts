import { defineConfig, devices } from "@playwright/test";

/**
 * WALLET-A11Y — Denali member portal wallet accessibility (Postgres E2E).
 */
function chromiumHostResolverArgs(): string[] {
  const rules = ["MAP portal.denali-wallet-pilot.localhost 127.0.0.1"].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-wallet-member-a11y.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 300_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://portal.denali-wallet-pilot.localhost:3003",
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumHostResolverArgs() },
  },
  webServer: {
    command: "node ../../scripts/smoke-denali-wallet-pilot-servers.mjs",
    url: "http://127.0.0.1:3003/health",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
