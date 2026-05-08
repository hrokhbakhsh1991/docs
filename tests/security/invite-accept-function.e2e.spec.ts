import { runAppsApiE2e } from "./run-api-e2e";

describe("invite-accept-function (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("invite-accept-function.e2e-spec.ts");
  });
});
