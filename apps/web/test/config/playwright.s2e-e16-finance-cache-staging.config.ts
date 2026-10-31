import { defineTwoTenantStagingConfig } from "../fixtures/two-tenant-staging-config.mts";

export default defineTwoTenantStagingConfig({
  testDir: "./tests/e2e",
  testMatch: "s2-e16-finance-cache-staging.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  use: {
    screenshot: "off",
    trace: "off",
    video: "off",
    serviceWorkers: "block",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
});
