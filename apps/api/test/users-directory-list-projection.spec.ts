import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUserTenantDirectoryWhere } from "../src/identity/users-directory-list-projection";

describe("users-directory-list-projection", () => {
  it("adds a UUID identity predicate for exact member lookup", () => {
    const where = buildUserTenantDirectoryWhere("tenant-1", {
      search: "00000000-0000-4000-8000-000000000423",
      status: "active",
    });

    assert.equal(where.tenantId, "tenant-1");
    assert.equal(where.status, "ACTIVE");
    assert.ok(Array.isArray(where.OR));
    assert.deepEqual(where.OR?.[0], {
      user: { id: "00000000-0000-4000-8000-000000000423" },
    });
  });

  it("does not treat arbitrary search text as a UUID predicate", () => {
    const where = buildUserTenantDirectoryWhere("tenant-1", { search: "ali" });

    assert.ok(Array.isArray(where.OR));
    assert.equal(JSON.stringify(where.OR).includes('"id"'), false);
  });
});
