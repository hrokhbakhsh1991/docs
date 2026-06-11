/**
 * M17 tour intake — session-backed catalog registration headers
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";

describe("build-catalog-registration-headers.spec.ts", () => {
  const tenantId = "00000000-0000-4000-8000-000000000004";
  const userId = "00000000-0000-4000-8000-000000000402";

  it("HDR-01 guest headers when session missing", () => {
    const headers = mergeCatalogRegistrationHeaders(tenantId, null);
    assert.equal(headers["x-tenant-id"], tenantId);
    assert.equal(headers["x-user-id"], undefined);
  });

  it("HDR-02 guest headers when session tenant mismatches", () => {
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      userId,
      tenantId: "00000000-0000-4000-8000-000000000014",
      role: "member",
    });
    assert.equal(headers["x-tenant-id"], tenantId);
    assert.equal(headers["x-user-id"], undefined);
  });

  it("HDR-03 session user forwarded when tenant matches", () => {
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      userId,
      tenantId,
      role: "member",
    });
    assert.equal(headers["x-user-id"], userId);
    assert.equal(headers["x-actor-role"], "member");
    assert.equal(headers["x-membership-status"], "ACTIVE");
  });
});
