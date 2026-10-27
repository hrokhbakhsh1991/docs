import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  testMatch: ["tour-creation-free-group-capacity-staging.spec.ts"],
  retries: 0,
  workers: 1,
});
