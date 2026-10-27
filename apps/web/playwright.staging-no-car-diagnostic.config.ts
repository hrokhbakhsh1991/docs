import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  testMatch: ["staging-no-car-diagnostic-harness.spec.ts"],
  retries: 0,
  workers: 1,
});
