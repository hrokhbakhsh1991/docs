import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStagingAdminSmokeHost } from "../vps-deploy/resolve-staging-admin-smoke-host.mjs";

const originMap = JSON.stringify({
  version: 1,
  tenants: [
    {
      tenantId: "00000000-0000-4000-8000-000000000003",
      origins: {
        admin: "https://admin.denali.staging.test",
        marketing: "https://denali.staging.test",
        portal: "https://portal.denali.staging.test",
      },
      cookieDomain: "denali.staging.test",
      aliases: {
        admin: [
          { origin: "https://admin.denali.shenski.com", cookieDomain: "shenski.com" },
          { origin: "https://staging-admin-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
      },
    },
    {
      tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
      origins: {
        admin: "https://admin.qa2.staging.test",
        marketing: "https://qa2.staging.test",
        portal: "https://portal.qa2.staging.test",
      },
      cookieDomain: "qa2.staging.test",
      aliases: {
        admin: [{ origin: "https://staging-admin-qa2.shenski.com", cookieDomain: "shenski.com" }],
      },
    },
  ],
});

describe("resolve-staging-admin-smoke-host", () => {
  it("selects the configured public admin alias mapped to tenant A, not its private origin", () => {
    assert.equal(
      resolveStagingAdminSmokeHost(originMap, "staging-admin-denali.shenski.com"),
      "staging-admin-denali.shenski.com"
    );
  });

  it("accepts the canonical admin origin only when it is the configured ingress host", () => {
    assert.equal(
      resolveStagingAdminSmokeHost(originMap, "admin.denali.staging.test"),
      "admin.denali.staging.test"
    );
  });

  it("rejects an unconfigured, marketing, or tenant-B host", () => {
    for (const host of [
      "unknown.shenski.com",
      "staging-denali.shenski.com",
      "staging-admin-qa2.shenski.com",
    ]) {
      assert.throws(
        () => resolveStagingAdminSmokeHost(originMap, host),
        /not explicitly mapped to tenant A's admin surface/
      );
    }
  });

  it("fails closed when map JSON or the configured admin host is missing", () => {
    assert.throws(
      () => resolveStagingAdminSmokeHost("{invalid", "staging-admin-denali.shenski.com"),
      /must contain valid JSON/
    );
    assert.throws(() => resolveStagingAdminSmokeHost(originMap, ""), /must be configured/);
  });

  it("rejects configured hosts containing ports or URL components", () => {
    for (const host of [
      "staging-admin-denali.shenski.com:443",
      "staging-admin-denali.shenski.com/path",
      "staging-admin-denali.shenski.com?tenant=b",
      "staging-admin-denali.shenski.com#fragment",
    ]) {
      assert.throws(
        () => resolveStagingAdminSmokeHost(originMap, host),
        /hostnames without ports or paths/
      );
    }
  });
});
