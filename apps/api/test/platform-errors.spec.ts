import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlatformForbidden, PlatformUnauthorized } from "../src/platform/platform.errors";

describe("platform errors codes", () => {
  it("PLATFORM_UNAUTHORIZED code", () => {
    const e = new PlatformUnauthorized();
    assert.equal((e as any).code, "PLATFORM_UNAUTHORIZED");
  });

  it("PLATFORM_FORBIDDEN code", () => {
    const e = new PlatformForbidden();
    assert.equal((e as any).code, "PLATFORM_FORBIDDEN");
  });
});
