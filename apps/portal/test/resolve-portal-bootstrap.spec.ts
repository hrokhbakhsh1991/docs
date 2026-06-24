import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePortalBootstrapForHost } from "../src/tenant/resolve-portal-bootstrap";

describe("resolvePortalBootstrapForHost", () => {
  it("PTL-12 dev operator.portal host resolves operator smoke tenant", async () => {
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      const bootstrap = await resolvePortalBootstrapForHost("operator.portal.localhost:3003");
      assert.equal(bootstrap.tenantId, "00000000-0000-4000-8000-000000000014");
      assert.equal(bootstrap.pluginId, "denali");
    } finally {
      if (priorAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNodeEnv;
    }
  });

  it("P8-0-N-005 production unknown host throws PORTAL_TENANT_UNRESOLVED", async () => {
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const priorNodeEnv = process.env.NODE_ENV;
    const priorApiUrl = process.env.TOUR_OPS_API_URL;
    const priorJwt = process.env.AUTH_JWT_PUBLIC_KEY;
    process.env.NODE_ENV = "production";
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:1";
    process.env.AUTH_JWT_PUBLIC_KEY = "test-key";
    delete process.env.ALLOW_DEV_WEB_SESSION;
    try {
      await assert.rejects(
        () => resolvePortalBootstrapForHost("unmapped-brand.localhost:3003"),
        /PORTAL_TENANT_UNRESOLVED/
      );
    } finally {
      if (priorAllow === undefined) delete process.env.ALLOW_DEV_WEB_SESSION;
      else process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNodeEnv;
      if (priorApiUrl === undefined) delete process.env.TOUR_OPS_API_URL;
      else process.env.TOUR_OPS_API_URL = priorApiUrl;
      if (priorJwt === undefined) delete process.env.AUTH_JWT_PUBLIC_KEY;
      else process.env.AUTH_JWT_PUBLIC_KEY = priorJwt;
    }
  });
});
