import { defineConfig, devices } from "@playwright/test";

const operatorBaseUrl =
  process.env.SMOKE_BASE_URL ?? "http://admin.operator.localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["denali-wave-b5-dp3-mutation-evidence.spec.ts", "denali-waiver-evidence.spec.ts"],
  retries: 0,
  workers: 1,
  timeout: 360_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: operatorBaseUrl,
    viewport: { width: 1440, height: 900 },
    navigationTimeout: 180_000,
  },
  reporter: [["list"]],
});
