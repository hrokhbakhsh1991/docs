import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertPlatformOpsImpersonateRole } from "../src/platform/assert-platform-ops-impersonate-role.ts";
import { PlatformForbidden } from "../src/platform/platform.errors.ts";

describe("assertPlatformOpsImpersonateRole", () => {
  it("allows support role", () => {
    assert.equal(assertPlatformOpsImpersonateRole({ actorId: "+10000000099", roles: ["support"] }), true);
  });

  it("rejects guest role", () => {
    assert.throws(
      () => assertPlatformOpsImpersonateRole({ actorId: "x", roles: ["guest"] }),
      PlatformForbidden
    );
  });

  it("rejects empty roles", () => {
    assert.throws(
      () => assertPlatformOpsImpersonateRole({ actorId: "x", roles: [] }),
      PlatformForbidden
    );
  });
});
