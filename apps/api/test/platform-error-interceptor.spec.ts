import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPlatformErrorToStatus } from "../src/platform/error-interceptor";
import { PlatformUnauthorized, PlatformValidation } from "../src/platform/platform.errors";

describe("platform error interceptor", () => {
  it("maps 401 unauthorized", () => {
    const s = mapPlatformErrorToStatus(new PlatformUnauthorized());
    assert.equal(s, 401);
  });

  it("maps 422 validation", () => {
    const s = mapPlatformErrorToStatus(new PlatformValidation());
    assert.equal(s, 422);
  });
});
