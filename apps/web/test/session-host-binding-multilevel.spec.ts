import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

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
    assert.equal(
      resolveExpectedTenantIdForHost("denali.admin.localhost:3000"),
      DENALI_TENANT
    );
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

  it("root bootstrap uses tenant-context after static map miss", () => {
    const kernel = readFileSync(
      new URL("../src/tenant/tenant-kernel.server.ts", import.meta.url),
      "utf8"
    );
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    assert.match(kernel, /resolveBootstrapAppSessionForHostAsync/);
    assert.match(kernel, /fetchPublicTenantContextForHost/);
    assert.match(layout, /resolveBootstrapAppSessionForHostAsync/);
  });
});
