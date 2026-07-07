import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toPlatformTenantDto } from "../src/platform/platform-tenant.dto.ts";

describe("toPlatformTenantDto", () => {
  it("keys", () => {
    const dto = toPlatformTenantDto({
      id: "00000000-0000-4000-8000-000000000099",
      subdomain: "my-club",
      workspaceType: "denali",
      status: "active",
      createdAt: new Date("2026-06-21T12:00:00.000Z"),
    });
    assert.deepEqual(Object.keys(dto).sort(), [
      "createdAt",
      "id",
      "status",
      "subdomain",
      "workspaceType",
    ]);
    assert.equal(dto.subdomain, "my-club");
  });

  it("ISO date", () => {
    const dto = toPlatformTenantDto({
      id: "00000000-0000-4000-8000-000000000099",
      subdomain: "my-club",
      workspaceType: "denali",
      status: "active",
      createdAt: new Date("2026-06-21T12:00:00.000Z"),
    });
    assert.match(dto.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(dto.createdAt, "2026-06-21T12:00:00.000Z");
  });
});
