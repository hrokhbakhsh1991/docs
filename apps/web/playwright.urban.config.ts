import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 8.4 / P15-W-D2 — Urban product parity + create wizard smoke.
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
const urbanWebGateUrl =
  process.env.SMOKE_WEB_GATE_URL ?? "http://127.0.0.1:3000/health";

function chromiumHostResolverArgs(): string[] {
  const rules = [
    "MAP urban.localhost 127.0.0.1",
    "MAP portal.urban.localhost 127.0.0.1",
    "MAP urban.portal.localhost 127.0.0.1",
    "MAP workspace-owner-smoke.localhost 127.0.0.1",
    "MAP workspace-member-smoke.localhost 127.0.0.1",
    "MAP shop.urban.localhost 127.0.0.1",
  ].join(", ");
  return [`--host-resolver-rules=${rules}`];
}

export default defineConfig({
  globalSetup: "./tests/e2e/urban-e2e-global-setup.ts",
  testDir: "./tests/e2e",
  testMatch: ["urban-e2e-integrity.spec.ts", "urban-wizard-create.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_WEB_BASE_URL ?? "http://urban.localhost:3000",
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: chromiumHostResolverArgs() },
  },
  webServer: {
    command: "node scripts/smoke-urban-e2e-servers.mjs",
    url: urbanWebGateUrl,
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
