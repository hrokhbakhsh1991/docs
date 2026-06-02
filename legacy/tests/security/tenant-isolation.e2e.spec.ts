import { runAppsApiE2e } from "./run-api-e2e";

describe("tenant-isolation (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("tenant-isolation.e2e-spec.ts");
  });
});
