import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertPlatformOpsWriteRole } from "../src/platform/assert-platform-ops-role.ts";
import { PlatformForbidden } from "../src/platform/platform.errors.ts";

describe("platform rbac", () => {
  it("support 403", () => {
    assert.throws(
      () => assertPlatformOpsWriteRole({ actorId: "+10000000002", roles: ["support"] }),
      PlatformForbidden
    );
  });

  it("admin pass", () => {
    assert.equal(assertPlatformOpsWriteRole({ actorId: "+10000000003", roles: ["admin"] }), true);
  });
});
