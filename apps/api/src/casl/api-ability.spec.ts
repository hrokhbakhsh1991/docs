import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accessibleByTourWhere, createApiAbility } from "./api-ability";
import { tourSubject } from "./tour-subject";

describe("createApiAbility + accessibleByTourWhere (P3-E-DB-01)", () => {
  it("scopes tour read to actor tenant", () => {
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    const where = accessibleByTourWhere(ability, "read");
    assert.equal(where.tenantId, "tenant-a");
    assert.ok(ability.can("read", tourSubject({ tenantId: "tenant-a" })));
    assert.equal(ability.can("read", tourSubject({ tenantId: "tenant-b" })), false);
  });

  it("denies tour actions for suspended member (fail-closed)", () => {
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "member",
      status: "SUSPENDED",
      workspaceId: "ws-1",
    });
    assert.throws(
      () => accessibleByTourWhere(ability, "create"),
      /FORBIDDEN_TOUR_CREATE/,
    );
  });
});
