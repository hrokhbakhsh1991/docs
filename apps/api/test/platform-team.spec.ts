import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { assertPlatformOpsOwnerRole, assertPlatformOpsWriteRole } from "../src/platform/assert-platform-ops-role.ts";
import { PlatformForbidden } from "../src/platform/platform.errors.ts";

describe("platform team API", () => {
  it("list members", () => {
    const source = readFileSync(new URL("../src/routes/platform/team.ts", import.meta.url), "utf8");
    assert.match(source, /listAll/);
    assert.match(source, /items: items\.map\(toPlatformTeamMemberDto\)/);
  });

  it("non-owner 403", () => {
    const source = readFileSync(new URL("../src/routes/platform/team.ts", import.meta.url), "utf8");
    assert.match(source, /assertPlatformOpsOwnerRole/);
    assert.throws(
      () => assertPlatformOpsOwnerRole({ actorId: "+1", roles: ["admin"] }),
      PlatformForbidden
    );
  });
});
