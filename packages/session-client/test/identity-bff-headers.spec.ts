import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIdentityBffHeadersForTenant } from "../src";

describe("identity-bff-headers", () => {
  it("builds anonymous OTP identity headers for a tenant host", () => {
    assert.deepEqual(
      buildIdentityBffHeadersForTenant("denali.localhost:3000", "tenant-1", {
        workspaceId: "workspace-1",
      }),
      {
        "x-tenant-id": "tenant-1",
        "x-authenticated-tenant-id": "tenant-1",
        "x-user-id": "00000000-0000-4000-8000-000000000099",
        "x-actor-role": "member",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": "workspace-1",
        host: "denali.localhost",
      }
    );
  });

  it("falls back to dev workspace id when no workspace id is provided", () => {
    assert.equal(
      buildIdentityBffHeadersForTenant("denali.localhost:3000", "tenant-1")["x-workspace-id"],
      "ws-operator-dev"
    );
  });
});
