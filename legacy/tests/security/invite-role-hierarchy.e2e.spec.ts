import { runAppsApiE2e } from "./run-api-e2e";

describe("invite-role-hierarchy (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("invite-role-hierarchy.e2e-spec.ts");
  });
});
