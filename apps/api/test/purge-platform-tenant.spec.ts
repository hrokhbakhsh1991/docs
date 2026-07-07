import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { purgePlatformTenant } from "../src/platform/purge-platform-tenant.ts";

describe("purgePlatformTenant", () => {
  it("returns false before scheduled deletion", async () => {
    const prisma = {
      tenant: {
        findUnique: async () => ({
          id: "t1",
          subdomain: "acme",
          status: "offboarding",
          scheduledDeletionAt: new Date(Date.now() + 86400000),
        }),
        delete: async () => ({}),
      },
    };
    const deleted = await purgePlatformTenant(
      { tenantId: "t1", actorId: "+989121234567" },
      { prisma: prisma as never, appendAudit: async () => {} }
    );
    assert.equal(deleted, false);
  });

  it("deletes when retention elapsed", async () => {
    let deleted = false;
    const prisma = {
      tenant: {
        findUnique: async () => ({
          id: "t1",
          subdomain: "acme",
          status: "offboarding",
          scheduledDeletionAt: new Date(Date.now() - 86400000),
        }),
        delete: async () => {
          deleted = true;
        },
      },
    };
    const result = await purgePlatformTenant(
      { tenantId: "t1", actorId: "+989121234567" },
      { prisma: prisma as never, appendAudit: async () => {} }
    );
    assert.equal(result, true);
    assert.equal(deleted, true);
  });
});
