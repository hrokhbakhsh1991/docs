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
});
