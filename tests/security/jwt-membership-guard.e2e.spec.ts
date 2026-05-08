import { runAppsApiE2e } from "./run-api-e2e";

describe("jwt-membership-guard (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("jwt-membership-guard.e2e-spec.ts");
  });
});
