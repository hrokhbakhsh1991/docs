import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantIdFromDevHost } from "../src/resolve-tenant-id-from-dev-host";

describe("resolveTenantIdFromDevHost admin surface", () => {
  it("WRS-GSH-03 admin surface resolves club admin host", () => {
    const prev = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("alborz.admin.localhost:3000", "admin"),
        "00000000-0000-4000-8000-000000000003"
      );
    } finally {
      if (prev === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = prev;
    }
  });

  it("WRS-GSH-04 custom apex admin host maps to denali tenant (H-P6-03 dev path)", () => {
    const prev = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
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
