import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";

describe("PlatformTenantRepository", () => {
  it("in list", async () => {
    const row = {
      id: "00000000-0000-4000-8000-000000000099",
      subdomain: "repo-test",
      workspaceType: "denali",
      status: "active",
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
    };
    const repo = new PlatformTenantRepository({
      tenant: {
        findMany: async () => [row],
        count: async () => 1,
        findUnique: async () => null,
      },
    } as never);

    const result = await repo.listPaginated(10, 0);
    assert.equal(result.total, 1);
    assert.equal(result.items[0]?.subdomain, "repo-test");
  });

  it("null unknown", async () => {
    const repo = new PlatformTenantRepository({
      tenant: {
        findMany: async () => [],
        count: async () => 0,
        findUnique: async () => null,
      },
    } as never);

    const missing = await repo.getById("00000000-0000-4000-8000-000000000000");
    assert.equal(missing, null);
  });
});
