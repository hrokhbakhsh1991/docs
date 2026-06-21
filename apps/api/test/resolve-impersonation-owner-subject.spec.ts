import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveImpersonationOwnerSubject } from "../src/platform/resolve-impersonation-owner-subject.ts";

describe("resolveImpersonationOwnerSubject", () => {
  it("exports async resolver function", () => {
    assert.equal(typeof resolveImpersonationOwnerSubject, "function");
  });

  it("returns a promise for unknown tenant", async () => {
    const result = resolveImpersonationOwnerSubject("00000000-0000-4000-8000-000000000099");
    assert.ok(result instanceof Promise);
    const value = await result.catch(() => null);
    assert.ok(value === null || typeof value === "object");
  });
});
