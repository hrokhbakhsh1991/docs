import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantIdFromDevHost } from "@app-tour/guest-surface-host";

describe("marketing-host-bind", () => {
  it("tenant subdomain from club apex", () => {
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("denali.localhost:3002", "marketing"),
        "00000000-0000-4000-8000-000000000003"
      );
    } finally {
      process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
    }
  });
});
