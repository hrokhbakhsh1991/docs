import { runAppsApiE2e } from "./run-api-e2e";

describe("tenant-context-leak (security e2e)", () => {
  it("delegates to apps/api node:test suite", () => {
    runAppsApiE2e("tenant-context-leak.e2e-spec.ts");
  });
});
