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
});
