import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlatformWriteRole } from "../src/platform/platform-auth-context.ts";
import type { PlatformAuthContext } from "../src/platform/platform-auth-context.ts";

describe("PlatformAuthContext", () => {
  it("owner true - returns true for owner role", () => {
    const ctx: PlatformAuthContext = {
      actorId: "user-123",
      roles: ["owner"]
    };
    const result = isPlatformWriteRole(ctx);
    assert.strictEqual(result, true, "Should return true for owner role");
  });

  it("support false - returns false for support role", () => {
    const ctx: PlatformAuthContext = {
      actorId: "user-456",
      roles: ["support"]
    };
    const result = isPlatformWriteRole(ctx);
    assert.strictEqual(result, false, "Should return false for support role");
  });
});

// Made with Bob
