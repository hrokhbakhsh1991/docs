import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isDevWebSessionAllowed } from "../src/tenant/auth-env";
import { buildTourAuthHeaders } from "../src/tenant/tour-auth-headers";
import { resolveBootstrapAppSession } from "../src/tenant/tenant-kernel";

const env = process.env as Record<string, string | undefined>;

const envSnapshot = {
  NODE_ENV: env.NODE_ENV,
  ALLOW_DEV_WEB_SESSION: env.ALLOW_DEV_WEB_SESSION,
  TOUR_OPS_DEV_TENANT_ID: env.TOUR_OPS_DEV_TENANT_ID,
};

afterEach(() => {
  if (envSnapshot.NODE_ENV !== undefined) {
    env.NODE_ENV = envSnapshot.NODE_ENV;
  } else {
    delete env.NODE_ENV;
  }
  if (envSnapshot.ALLOW_DEV_WEB_SESSION !== undefined) {
    env.ALLOW_DEV_WEB_SESSION = envSnapshot.ALLOW_DEV_WEB_SESSION;
  } else {
    delete env.ALLOW_DEV_WEB_SESSION;
  }
  if (envSnapshot.TOUR_OPS_DEV_TENANT_ID !== undefined) {
    env.TOUR_OPS_DEV_TENANT_ID = envSnapshot.TOUR_OPS_DEV_TENANT_ID;
  } else {
    delete env.TOUR_OPS_DEV_TENANT_ID;
  }
});

describe("isDevWebSessionAllowed", () => {
  it("requires development + ALLOW_DEV_WEB_SESSION", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(isDevWebSessionAllowed(), true);

    env.ALLOW_DEV_WEB_SESSION = "false";
    assert.equal(isDevWebSessionAllowed(), false);
  });
});

describe("resolveBootstrapAppSession", () => {
  it("throws when dev web session is not allowed", () => {
    env.NODE_ENV = "test";
    delete env.ALLOW_DEV_WEB_SESSION;
    assert.throws(() => resolveBootstrapAppSession(), /WEB_SESSION_NOT_CONFIGURED/);
  });

  it("resolves session when dev web session is allowed", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    env.TOUR_OPS_DEV_TENANT_ID = "tenant-test";
    const resolved = resolveBootstrapAppSession();
    assert.equal(resolved.session.tenantId, "tenant-test");
  });
});

describe("buildTourAuthHeaders", () => {
  it("maps tenant context to ingress headers", () => {
    const headers = buildTourAuthHeaders({
      userId: "u1",
      tenantId: "t1",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws1",
    });
    assert.equal(headers["x-tenant-id"], "t1");
    assert.equal(headers["x-workspace-id"], "ws1");
  });
});
