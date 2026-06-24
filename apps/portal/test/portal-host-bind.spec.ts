import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantIdFromDevHost } from "@app-tour/guest-surface-host";

describe("portal-host-bind", () => {
  it("portal club_portal host ok", () => {
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("denali.portal.localhost:3003", "portal"),
        "00000000-0000-4000-8000-000000000003"
      );
    } finally {
      process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
    }
  });

  it("portal legacy club_apex host ok", () => {
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        resolveTenantIdFromDevHost("operator.localhost:3003", "portal"),
        "00000000-0000-4000-8000-000000000014"
      );
    } finally {
      process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
    }
  });
});
