import { runAppsApiE2e } from "./run-api-e2e";

describe("payments-webhook-wrong-tenant (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("payments-webhook-wrong-tenant.e2e-spec.ts");
  });
});
