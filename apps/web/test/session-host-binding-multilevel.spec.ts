import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

import { requireOperatorSessionWeb } from "../src/admin/require-operator-session";
import {
  resolveExpectedTenantIdForHost,
  sessionTenantMatchesHost,
} from "../src/tenant/session-host-binding";

const DENALI_TENANT = "00000000-0000-4000-8000-000000000003";

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  NODE_ENV: env.NODE_ENV,
  ALLOW_DEV_WEB_SESSION: env.ALLOW_DEV_WEB_SESSION,
  TOUR_OPS_DEV_TENANT_ID: env.TOUR_OPS_DEV_TENANT_ID,
  PLATFORM_ROOT_DOMAIN: env.PLATFORM_ROOT_DOMAIN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("session-host-binding multilevel", () => {
  it("admin surface bind", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(resolveExpectedTenantIdForHost("denali.admin.localhost:3000"), DENALI_TENANT);
    assert.equal(sessionTenantMatchesHost(DENALI_TENANT, "denali.admin.localhost:3000"), true);
  });

  it("dynamic club admin host skips env fallback bind", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    env.TOUR_OPS_DEV_TENANT_ID = "00000000-0000-4000-8000-000000000014";
    const dynamicHost = "handoff-abc.admin.localhost:3000";
    const provisionedTenant = "00000000-0000-4000-8000-000000000099";
    assert.equal(resolveExpectedTenantIdForHost(dynamicHost), null);
    assert.equal(sessionTenantMatchesHost(provisionedTenant, dynamicHost), true);
  });

  it("production dynamic admin host binds to registry tenant and rejects other tenants", () => {
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_WEB_SESSION;
    env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    const dynamicHost = "admin.qa2.staging.test";
    const tenantB = "f0ed9e65-2638-4351-847d-724f87ebbfce";
    assert.equal(resolveExpectedTenantIdForHost(dynamicHost), null);
    assert.equal(
      sessionTenantMatchesHost(tenantB, dynamicHost, {
        resolvedTenantId: tenantB,
        failClosedWhenUnresolved: true,
      }),
      true
    );
    assert.equal(
      sessionTenantMatchesHost(DENALI_TENANT, dynamicHost, {
        resolvedTenantId: tenantB,
        failClosedWhenUnresolved: true,
      }),
      false
    );
  });

  it("production rejects a dynamic admin host when tenant resolution fails", () => {
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_WEB_SESSION;
    env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    assert.equal(
      sessionTenantMatchesHost(DENALI_TENANT, "admin.unknown.staging.test", {
        resolvedTenantId: null,
        failClosedWhenUnresolved: true,
      }),
      false
    );
    assert.equal(
      sessionTenantMatchesHost(DENALI_TENANT, "admin.shenski.com", {
        resolvedTenantId: null,
        failClosedWhenUnresolved: true,
      }),
      true
    );
  });

  it("direct layout session gate also fails closed unless bootstrap tenant is supplied", () => {
    env.NODE_ENV = "production";
    delete env.ALLOW_DEV_WEB_SESSION;
    env.PLATFORM_ROOT_DOMAIN = "shenski.com";
    const session = {
      userId: "synthetic-owner-b",
      tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
      role: "owner" as const,
      workspaceType: "denali",
      pluginId: "denali",
    };
    const host = "admin.qa2.staging.test";

    assert.equal(
      requireOperatorSessionWeb({ session, pathname: "/dashboard", host }).allowed,
      false
    );
    assert.equal(
      requireOperatorSessionWeb({
        session,
        pathname: "/dashboard",
        host,
        resolvedTenantId: session.tenantId,
      }).allowed,
      true
    );
  });

  it("root bootstrap uses tenant-context after static map miss", () => {
    const kernel = readFileSync(
      new URL("../src/tenant/tenant-kernel.server.ts", import.meta.url),
      "utf8"
    );
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    assert.match(kernel, /resolveBootstrapAppSessionForHostAsync/);
    assert.match(kernel, /resolveAdminBootstrapForWebHost/);
    assert.doesNotMatch(kernel, /fetchPublicTenantContextForHost/);
    assert.match(layout, /resolveBootstrapAppSessionForHostAsync/);
  });
});
