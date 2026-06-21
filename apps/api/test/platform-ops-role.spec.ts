import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPlatformOpsWriteRole } from "../src/platform/assert-platform-ops-role.ts";
import { PlatformForbidden } from "../src/platform/platform.errors.ts";

describe("assertPlatformOpsWriteRole", () => {
  it("support throws - throws PlatformForbidden for support role", () => {
    const ctx = {
      actorId: "user-123",
      roles: ["support"]
    };
    assert.throws(
      () => assertPlatformOpsWriteRole(ctx),
      PlatformForbidden,
      "Should throw PlatformForbidden for support role"
    );
  });

  it("admin ok - returns true for admin role", () => {
    const ctx = {
      actorId: "user-456",
      roles: ["admin"]
    };
    const result = assertPlatformOpsWriteRole(ctx);
    assert.strictEqual(result, true, "Should return true for admin role");
  });
});

// Made with Bob
