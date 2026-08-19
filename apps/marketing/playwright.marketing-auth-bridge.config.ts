import { defineConfig, devices } from "@playwright/test";

const marketingBaseUrl = process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["marketing-auth-bridge.spec.ts"],
  retries: 0,
  workers: 1,
  timeout: 90_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: marketingBaseUrl,
    viewport: { width: 1440, height: 900 },
  },
});
