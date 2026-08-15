import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  sessionMemberMatchesPortalGuestSurface,
  sessionMemberMatchesPortalTenant,
  sessionTenantMatchesHost,
} from "../src/tenant/session-host-binding";

const TENANT_A = "00000000-0000-4000-8000-000000000003";
const TENANT_B = "00000000-0000-4000-8000-000000000014";

describe("session-host-binding — PCMS-SEC-01", () => {
  it("PCMS-01 sessionMemberMatchesPortalTenant compares trimmed ids", () => {
    assert.equal(sessionMemberMatchesPortalTenant(TENANT_A, TENANT_A), true);
    assert.equal(sessionMemberMatchesPortalTenant(TENANT_A, TENANT_B), false);
  });

  it("PCMS-02 fail-closed when bootstrap tenantId is resolved", () => {
    assert.equal(
      sessionTenantMatchesHost(TENANT_A, "unknown.host:3003", {
        resolvedPortalTenantId: TENANT_B,
      }),
      false
    );
    assert.equal(
      sessionTenantMatchesHost(TENANT_B, "unknown.host:3003", {
        resolvedPortalTenantId: TENANT_B,
      }),
      true
    );
  });

  it("PCMS-03 dev portal host map still binds without bootstrap", () => {
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        sessionTenantMatchesHost(TENANT_A, "denali.portal.localhost:3003"),
        true
      );
      assert.equal(
        sessionTenantMatchesHost(TENANT_B, "denali.portal.localhost:3003"),
        false
      );
    } finally {
      process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
    }
  });

  it("PCMS-03b guest auth surfaces reuse cross-surface dev tenant bind", () => {
    const oldAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const oldNode = process.env.NODE_ENV;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      assert.equal(
        sessionMemberMatchesPortalGuestSurface(TENANT_A, "denali.portal.localhost:3003", TENANT_B),
        true
      );
      assert.equal(
        sessionMemberMatchesPortalGuestSurface(TENANT_B, "denali.portal.localhost:3003", TENANT_B),
        true
      );
    } finally {
      if (oldAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = oldAllow;
      if (oldNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldNode;
    }
  });

  it("PCMS-SEC-02 fail-closed when unresolved and production mode", () => {
    assert.equal(
      sessionTenantMatchesHost(TENANT_A, "unknown.example.com", {
        failClosedWhenUnresolved: true,
      }),
      false
    );
  });
});
