import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingBootstrapForHost } from "../src/tenant/resolve-marketing-bootstrap";

describe("resolveMarketingBootstrapForHost", () => {
  it("MKT-12 dev shop.operator host resolves operator smoke tenant", async () => {
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      const bootstrap = await resolveMarketingBootstrapForHost("shop.operator.localhost:3002");
      assert.equal(bootstrap.tenantId, "00000000-0000-4000-8000-000000000014");
      assert.equal(bootstrap.pluginId, "denali");
    } finally {
      if (priorAllow === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      }
      if (priorNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNodeEnv;
      }
    }
  });

  it("MKT-13 dev urban.localhost resolves urban smoke tenant + plugin", async () => {
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    try {
      const bootstrap = await resolveMarketingBootstrapForHost("urban.localhost:3002");
      assert.equal(bootstrap.tenantId, "00000000-0000-4000-8000-000000000004");
      assert.equal(bootstrap.pluginId, "urban");
    } finally {
      if (priorAllow === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      }
      if (priorNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNodeEnv;
      }
    }
  });

  it("P8-0-N-002 production unknown host throws when tenant-context unavailable", async () => {
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
        () => resolveMarketingBootstrapForHost("unmapped-brand.localhost:3002"),
        /MARKETING_TENANT_UNRESOLVED/
      );
    } finally {
      if (priorAllow === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      }
      if (priorNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNodeEnv;
      }
      if (priorApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = priorApiUrl;
      }
      if (priorJwt === undefined) {
        delete process.env.AUTH_JWT_PUBLIC_KEY;
      } else {
        process.env.AUTH_JWT_PUBLIC_KEY = priorJwt;
      }
    }
  });

  it("P8-0-N-002 development may use env fallback when API and host map miss", async () => {
    const priorAllow = process.env.ALLOW_DEV_WEB_SESSION;
    const priorNodeEnv = process.env.NODE_ENV;
    const priorDevTenant = process.env.TOUR_OPS_DEV_TENANT_ID;
    const priorApiUrl = process.env.TOUR_OPS_API_URL;
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    process.env.NODE_ENV = "development";
    process.env.TOUR_OPS_DEV_TENANT_ID = "00000000-0000-4000-8000-000000000014";
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:1";
    try {
      const bootstrap = await resolveMarketingBootstrapForHost("unmapped-brand.localhost:3002");
      assert.equal(bootstrap.tenantId, "00000000-0000-4000-8000-000000000014");
      assert.equal(bootstrap.pluginId, "denali");
    } finally {
      if (priorAllow === undefined) {
        delete process.env.ALLOW_DEV_WEB_SESSION;
      } else {
        process.env.ALLOW_DEV_WEB_SESSION = priorAllow;
      }
      if (priorNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNodeEnv;
      }
      if (priorDevTenant === undefined) {
        delete process.env.TOUR_OPS_DEV_TENANT_ID;
      } else {
        process.env.TOUR_OPS_DEV_TENANT_ID = priorDevTenant;
      }
      if (priorApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = priorApiUrl;
      }
    }
  });
});
