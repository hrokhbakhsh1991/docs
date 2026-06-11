/**
 * Phase 9.1 — workspace host ↔ session tenant isolation (Denali-only dev)
 * Authority: docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md § Admin access model
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveExpectedTenantIdForHost,
  sessionTenantMatchesHost,
} from "../src/tenant/session-host-binding";

const DENALI_TENANT = "00000000-0000-4000-8000-000000000003";
const OPERATOR_TENANT = "00000000-0000-4000-8000-000000000014";
const URBAN_TENANT = "00000000-0000-4000-8000-000000000004";

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

describe("auth-tenant-host-isolation.spec.ts", () => {
  it("WEB-9.1-10 denali.localhost expects Denali tenant UUID", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(resolveExpectedTenantIdForHost("denali.localhost:3000"), DENALI_TENANT);
  });

  it("WEB-9.1-11 operator.localhost maps to operator smoke tenant", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(resolveExpectedTenantIdForHost("operator.localhost:3000"), OPERATOR_TENANT);
  });

  it("WEB-9.1-12 Denali session rejected on operator host", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(sessionTenantMatchesHost(DENALI_TENANT, "operator.localhost:3000"), false);
  });

  it("WEB-9.1-13 Denali session accepted on denali host", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(sessionTenantMatchesHost(DENALI_TENANT, "denali.localhost:3000"), true);
  });

  it("WEB-9.1-14 urban host does not accept Denali session", () => {
    env.NODE_ENV = "development";
    env.ALLOW_DEV_WEB_SESSION = "true";
    assert.equal(sessionTenantMatchesHost(DENALI_TENANT, "urban.localhost:3000"), false);
    assert.equal(resolveExpectedTenantIdForHost("urban.localhost:3000"), URBAN_TENANT);
  });
});
