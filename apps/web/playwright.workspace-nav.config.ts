import { defineConfig, devices } from "@playwright/test";

/** Instrumentation run against already-running dev servers (admin.denali.localhost). */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["workspace-nav-instrumentation.spec.ts"],
  workers: 1,
  timeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.denali.localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  reporter: [["list"]],
});
