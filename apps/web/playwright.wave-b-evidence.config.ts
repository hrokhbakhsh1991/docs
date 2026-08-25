import { defineConfig, devices } from "@playwright/test";

const operatorBaseUrl =
  process.env.SMOKE_BASE_URL ?? "http://denali.admin.localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-wave-b-operator-evidence.spec.ts"],
  retries: 0,
  workers: 1,
  timeout: 240_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: operatorBaseUrl,
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 180_000,
  },
  reporter: [["list"]],
});
