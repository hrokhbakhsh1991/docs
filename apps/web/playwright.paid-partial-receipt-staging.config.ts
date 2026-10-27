import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  testMatch: ["tour-creation-paid-partial-receipt-staging.spec.ts"],
  retries: 0,
  workers: 1,
});
