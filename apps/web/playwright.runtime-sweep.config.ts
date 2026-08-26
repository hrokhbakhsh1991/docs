import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: ["operator-ux-runtime-sweep.spec.ts"],
  workers: 1,
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://admin.denali.localhost:3000",
  },
  reporter: [["list"]],
});
