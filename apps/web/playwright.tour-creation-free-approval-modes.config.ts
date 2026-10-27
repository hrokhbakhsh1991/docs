import { defineTourCreationStagingConfig } from "./test/fixtures/tour-creation-staging-config";

export default defineTourCreationStagingConfig({
  retries: 0,
  timeout: 180_000,
  testMatch: ["tour-creation-free-approval-modes.spec.ts"],
});
