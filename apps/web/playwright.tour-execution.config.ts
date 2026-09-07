import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SMOKE_OPERATOR_BASE_URL ?? "http://admin.denali.localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["operator-tour-execution.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 180_000,
  },
  webServer: {
    command: "node scripts/smoke-denali-e2e-servers.mjs",
    url: "http://127.0.0.1:3000/",
    reuseExistingServer: !process.env.CI && process.env.PW_NO_REUSE_SERVER !== "1",
    timeout: 720_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  reporter: [["list"]],
});
