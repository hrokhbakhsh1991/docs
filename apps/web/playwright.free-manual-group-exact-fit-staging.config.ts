import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  testMatch: ["tour-creation-free-manual-group-exact-fit-staging.spec.ts"],
  retries: 0,
  workers: 1,
});
