import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accessibleByTourWhere, createApiAbility } from "../../src/casl/api-ability.js";

/**
 * P3-ENTRY-04 — documents Prisma `accessibleBy` equivalence before Prisma client exists.
 * See `apps/api/docs/prisma-accessible-by.md`.
 */
describe("Prisma accessibleBy reference (P3-ENTRY-04)", () => {
  it("accessibleByTourWhere is the tenant scope Prisma accessibleBy would enforce", () => {
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-scope",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    assert.deepEqual(accessibleByTourWhere(ability, "read"), { tenantId: "tenant-scope" });
  });
});
