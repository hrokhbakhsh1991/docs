import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionTenantMatchesDevCrossSurfaceHost } from "../src/session-tenant-matches-dev-cross-surface-host";

const DENALI_TENANT = "00000000-0000-4000-8000-000000000003";
const OPERATOR_TENANT = "00000000-0000-4000-8000-000000000014";

describe("sessionTenantMatchesDevCrossSurfaceHost — PCMS-03-DEV", () => {
  it("PCMS-03DEV-01 matches bootstrap tenant directly", () => {
    assert.equal(
      sessionTenantMatchesDevCrossSurfaceHost(DENALI_TENANT, "denali.localhost:3002", DENALI_TENANT),
      true
    );
  });

  it("PCMS-03DEV-02 matches dev host map on current host", () => {
    const priorNode = process.env.NODE_ENV;
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        sessionTenantMatchesDevCrossSurfaceHost(
          DENALI_TENANT,
          "denali.localhost:3002",
          OPERATOR_TENANT
        ),
        true
      );
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
    }
  });

  it("PCMS-03DEV-03 widens unmapped localhost when dev session allowed", () => {
    const priorNode = process.env.NODE_ENV;
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    try {
      assert.equal(
        sessionTenantMatchesDevCrossSurfaceHost(
          DENALI_TENANT,
          "localhost:3002",
          OPERATOR_TENANT
        ),
        true
      );
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
    }
  });

  it("PCMS-03DEV-04 production host stays strict when dev gate off", () => {
    const priorNode = process.env.NODE_ENV;
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_WEB_SESSION;
    try {
      assert.equal(
        sessionTenantMatchesDevCrossSurfaceHost(
          DENALI_TENANT,
          "localhost:3002",
          OPERATOR_TENANT
        ),
        false
      );
      assert.equal(
        sessionTenantMatchesDevCrossSurfaceHost(
          DENALI_TENANT,
          "denali.club",
          OPERATOR_TENANT
        ),
        false
      );
    } finally {
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
      if (priorAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
    }
  });
});
