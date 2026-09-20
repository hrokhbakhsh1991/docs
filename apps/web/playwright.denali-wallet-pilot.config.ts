import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 2 — Denali Wallet pilot operator certification (Postgres).
 */
const webGateUrl = process.env.SMOKE_WEB_GATE_URL ?? "http://127.0.0.1:3000/health";

function chromiumHostResolverArgs(): string[] {
  const rules = ["MAP admin.denali-wallet-pilot.localhost 127.0.0.1"].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-wallet-pilot-operator-certification.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL:
      process.env.SMOKE_DENALI_WALLET_PILOT_WEB_BASE_URL ??
      "http://admin.denali-wallet-pilot.localhost:3000",
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumHostResolverArgs() },
  },
  webServer: {
    command: "node ../../scripts/smoke-denali-wallet-pilot-servers.mjs",
    url: webGateUrl,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
