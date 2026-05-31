import { defineConfig } from "@playwright/test";

import { resolveTestPlatformBaseUrl } from "./lib/test/smoke-platform-url";

const smokeBaseURL = resolveTestPlatformBaseUrl();

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  testMatch: [
    "tests/smoke/**/*.spec.ts",
    "src/features/tours/__tests__/smoke/**/*.spec.ts",
  ],
  use: {
    // Workspace routes require a tenant host label (not bare loopback).
    baseURL: smokeBaseURL,
    navigationTimeout: 60_000,
  },
  webServer: process.env.PW_NO_WEB_SERVER
    ? undefined
    : {
        command: "node .next/standalone/apps/web/server.js",
        cwd: __dirname,
        url: smokeBaseURL,
        reuseExistingServer: process.env.CI ? false : process.env.PW_NO_REUSE_SERVER !== "1",
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_ENV: "development",
          HOSTNAME: "0.0.0.0",
          PORT: "3000",
          NEXT_PUBLIC_TENANT_ROOT_DOMAIN: "localhost",
          NEXT_PUBLIC_API_DYNAMIC_ORIGIN: "true",
          NEXT_PUBLIC_API_PORT: "3001",
          NEXT_PUBLIC_E2E_WIZARD_SEED: "true",
          NEXT_PUBLIC_TOUR_WIZARD_SERVER_DRAFT: "1",
          NEXT_PUBLIC_ENABLE_DENALI_DRAFT: "1",
        },
      },
  reporter: [["list"]],
});
