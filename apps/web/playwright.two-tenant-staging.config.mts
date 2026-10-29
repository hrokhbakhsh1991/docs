import { defineTwoTenantStagingConfig } from "./test/fixtures/two-tenant-staging-config.mts";

export default defineTwoTenantStagingConfig({
  testDir: "./tests/e2e",
  testMatch: "two-tenant-staging-network.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 45_000,
});
