import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveMarketingPublicBaseUrl,
  resolveMarketingTourDetailUrl,
} from "../src/resolve-marketing-public-base-url";

describe("resolve-marketing-public-base-url", () => {
  it("fails closed for a missing or non-allowlisted production origin", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousBase = process.env.MARKETING_PUBLIC_BASE_URL;
    const previousAllowlist = process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.MARKETING_PUBLIC_BASE_URL;
      delete process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
      assert.throws(
        () => resolveMarketingPublicBaseUrl("denali.portal.localhost:3003"),
        /allowlisted production origin/
      );
      process.env.MARKETING_PUBLIC_BASE_URL = "http://denali.shenski.com:23002";
      process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = "http://denali.shenski.com:23002";
      assert.throws(
        () => resolveMarketingPublicBaseUrl("denali.portal.localhost:3003"),
        /portless HTTP\(S\) origin/
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousBase === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL;
      else process.env.MARKETING_PUBLIC_BASE_URL = previousBase;
      if (previousAllowlist === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
      else process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = previousAllowlist;
    }
  });

  it("WRS-GSH-01 portal ingress maps to club marketing apex", () => {
    assert.equal(
      resolveMarketingPublicBaseUrl("denali.portal.localhost:3003"),
      "http://denali.localhost:3002"
    );
  });

  it("WRS-GSH-02 never emits shop on egress", () => {
    const url = resolveMarketingTourDetailUrl("operator.admin.localhost:3000", "t1");
    assert.equal(url, "http://operator.localhost:3002/tours/t1");
    assert.equal(url.includes("shop."), false);
  });

  it("uses the registered tenant origin instead of the global A fallback", () => {
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      base: process.env.MARKETING_PUBLIC_BASE_URL,
      allowlist: process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST,
      tenantMap: process.env.TENANT_SURFACE_ORIGIN_MAP_JSON,
    };
    process.env.NODE_ENV = "production";
    process.env.MARKETING_PUBLIC_BASE_URL = "https://denali.staging.test";
    process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = "https://denali.staging.test";
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify({
      version: 1,
      tenants: [
        {
          tenantId: "00000000-0000-4000-8000-000000000003",
          origins: {
            marketing: "https://denali.staging.test",
            admin: "https://admin.denali.staging.test",
            portal: "https://portal.denali.staging.test",
          },
          cookieDomain: "denali.staging.test",
        },
        {
          tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
          origins: {
            marketing: "https://qa2.staging.test",
            admin: "https://admin.qa2.staging.test",
            portal: "https://portal.qa2.staging.test",
          },
          cookieDomain: "qa2.staging.test",
        },
      ],
    });
    try {
      assert.equal(
        resolveMarketingPublicBaseUrl("portal.qa2.staging.test"),
        "https://qa2.staging.test"
      );
      assert.throws(() => resolveMarketingPublicBaseUrl("unknown.example"), /not allowlisted/);
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.base === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL;
      else process.env.MARKETING_PUBLIC_BASE_URL = previous.base;
      if (previous.allowlist === undefined) delete process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST;
      else process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST = previous.allowlist;
      if (previous.tenantMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previous.tenantMap;
    }
  });
});
