import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantIdFromDevHost } from "../src/resolve-tenant-id-from-dev-host";

describe("resolveTenantIdFromDevHost custom apex", () => {
  it("WRS-GSH-05 portal.denali.club maps to denali tenant in dev", () => {
    const prev = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("portal.denali.club:3003", "portal"),
        "00000000-0000-4000-8000-000000000003"
      );
      assert.equal(
        resolveTenantIdFromDevHost("admin.denali.club:3000", "admin"),
        "00000000-0000-4000-8000-000000000003"
      );
    } finally {
      if (prev === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = prev;
    }
  });
});
