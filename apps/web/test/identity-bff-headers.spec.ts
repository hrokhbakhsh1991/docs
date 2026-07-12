/**
 * Operator auth BFF tenant resolution (M17.2)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  OPERATOR_BFF_TENANT_UNRESOLVED,
  resolveOperatorBffTenantId,
} from "../src/auth/identity-bff-headers";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_DEV_WEB_SESSION: process.env.ALLOW_DEV_WEB_SESSION,
  TOUR_OPS_API_URL: process.env.TOUR_OPS_API_URL,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.ALLOW_DEV_WEB_SESSION = ENV_SNAPSHOT.ALLOW_DEV_WEB_SESSION;
  process.env.TOUR_OPS_API_URL = ENV_SNAPSHOT.TOUR_OPS_API_URL;
  process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
});

describe("identity-bff-headers.spec.ts — M17.2", () => {
  it("OP-BFF-01 dev host map resolves denali tenant", async () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    const tenantId = await resolveOperatorBffTenantId("denali.localhost:3000");
    assert.equal(tenantId, "00000000-0000-4000-8000-000000000003");
  });

  it("OP-BFF-02 unresolved production host throws", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_WEB_SESSION;
    process.env.TOUR_OPS_API_URL = "http://127.0.0.1:9";
    process.env.AUTH_JWT_PUBLIC_KEY = "test-public-key";
    await assert.rejects(
      () => resolveOperatorBffTenantId("unknown-operator.example.com"),
      new RegExp(OPERATOR_BFF_TENANT_UNRESOLVED)
    );
  });
});
