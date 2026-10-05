import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePublicAuthCorsAllowOrigin } from "../src/resolve-public-auth-cors-allow-origin";

describe("resolvePublicAuthCorsAllowOrigin — PCMS-CORS-02", () => {
  it("PCMS-CORS-P4-01b configured raw-IP staging origin is allowed", () => {
    const previous = process.env.TOUR_OPS_PUBLIC_FALLBACK_HOSTS;
    process.env.TOUR_OPS_PUBLIC_FALLBACK_HOSTS = "89.42.210.252";
    try {
      assert.equal(
        resolvePublicAuthCorsAllowOrigin({
          ingressHost: "portal.denali.shenski.com:23003",
          originHeader: "http://89.42.210.252:23002",
        }),
        "http://89.42.210.252:23002"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.TOUR_OPS_PUBLIC_FALLBACK_HOSTS;
      } else {
        process.env.TOUR_OPS_PUBLIC_FALLBACK_HOSTS = previous;
      }
    }
  });

  it("PCMS-CORS-P4-01 custom apex marketing origin is allowed on portal host", () => {
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: "http://denali.club:3002",
      }),
      "http://denali.club:3002"
    );
  });

  it("PCMS-CORS-P4-02 inverted localhost marketing origin is allowed", () => {
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.localhost:3003",
        originHeader: "http://denali.localhost:3002",
      }),
      "http://denali.localhost:3002"
    );
  });

  it("PCMS-CORS-P4-03 portal same-origin is allowed", () => {
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: "http://portal.denali.club:3003",
      }),
      "http://portal.denali.club:3003"
    );
  });

  it("PCMS-CORS-P4-04 other club / admin / arbitrary origins are rejected", () => {
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: "http://urban.localhost:3002",
      }),
      null
    );
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.localhost:3003",
        originHeader: "http://admin.denali.localhost:3000",
      }),
      null
    );
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: "https://evil.example",
      }),
      null
    );
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: "*",
      }),
      null
    );
    assert.equal(
      resolvePublicAuthCorsAllowOrigin({
        ingressHost: "portal.denali.club:3003",
        originHeader: null,
      }),
      null
    );
  });
});
