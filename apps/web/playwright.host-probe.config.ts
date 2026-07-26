import { defineConfig, devices } from "@playwright/test";

/**
 * Thin Shell Phase 4by — opt-in host-probe browser E2E.
 * Requires HOST_PROBE_E2E=1 and an already-running Next (PW_EXTERNAL_SERVERS=1).
 * Does not embed a webServer (avoids multi-minute CI loops).
 * @see docs/dev/thin-shell-host-probe-e2e.mdoc
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["workspace-host-probe.spec.ts"],
  retries: 0,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.HOST_PROBE_BASE_URL ?? "http://denali.localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  reporter: [["list"]],
});
