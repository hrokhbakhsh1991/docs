import { runAppsApiE2e } from "./run-api-e2e";

describe("invite-accept-parallel (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("invite-accept-parallel.e2e-spec.ts");
  });
});
