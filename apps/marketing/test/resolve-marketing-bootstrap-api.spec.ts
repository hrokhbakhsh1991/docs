import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMarketingTenantUnresolvedError,
  resolveMarketingBootstrapForApi,
} from "../src/tenant/resolve-marketing-bootstrap-api";

describe("resolveMarketingBootstrapForApi", () => {
  it("MKT-API-01 maps MARKETING_TENANT_UNRESOLVED to TENANT_HOST_UNKNOWN 404", async () => {
    const priorNodeEnv = process.env.NODE_ENV;
    const priorApiUrl = process.env.TOUR_OPS_API_URL;
    const priorJwt = process.env.AUTH_JWT_PUBLIC_KEY;
    process.env.NODE_ENV = "production";
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:1";
    process.env.AUTH_JWT_PUBLIC_KEY = "test-key";
    delete process.env.ALLOW_DEV_WEB_SESSION;

    try {
      const result = await resolveMarketingBootstrapForApi("unknown.invalid");
      assert.equal(result.ok, false);
      if (result.ok) {
        assert.fail("expected unresolved host");
      }
      assert.equal(result.response.status, 404);
      const body = (await result.response.json()) as {
        error?: { code?: string };
      };
      assert.equal(body.error?.code, "TENANT_HOST_UNKNOWN");
      assert.equal(isMarketingTenantUnresolvedError(new Error("MARKETING_TENANT_UNRESOLVED")), true);
    } finally {
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
});
