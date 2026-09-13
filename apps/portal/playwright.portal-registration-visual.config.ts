import { defineConfig, devices } from "@playwright/test";

/** Focused registration visual QA — does not warm unrelated portal routes. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["portal-registration-visual-denali.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 240_000,
  navigationTimeout: 180_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.SMOKE_PORTAL_BASE_URL ?? "http://127.0.0.1:3003",
  },
  reporter: [["line"]],
});
