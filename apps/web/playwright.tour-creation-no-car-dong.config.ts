import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  retries: 0,
  testMatch: ["tour-creation-no-car-dong-boundary.spec.ts"],
});
