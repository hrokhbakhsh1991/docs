import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevMarketingPublicBaseUrl } from "../src/host/build-dev-marketing-public-base-url";
import { buildDevPortalPublicBaseUrl } from "../src/host/build-dev-portal-public-base-url";
import {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
} from "../src/host/parse-custom-apex-host";

describe("tryParseCustomApexHost", () => {
  it("WRS-CAX-01 detects marketing custom apex", () => {
    const parsed = tryParseCustomApexHost("alpine.club", "localhost", new Set());
    assert.equal(parsed.matched, true);
    if (parsed.matched) {
      assert.equal(parsed.surface, "marketing_apex");
      assert.equal(parsed.apex, "alpine.club");
    }
  });

  it("WRS-CAX-02 detects portal custom apex sibling", () => {
    const parsed = tryParseCustomApexHost("portal.alpine.club", "localhost", new Set());
    assert.equal(parsed.matched, true);
    if (parsed.matched) {
      assert.equal(parsed.surface, "portal");
      assert.equal(parsed.apex, "alpine.club");
    }
  });

  it("WRS-CAX-03 ignores platform club apex", () => {
    const parsed = tryParseCustomApexHost("operator.localhost", "localhost", new Set());
    assert.equal(parsed.matched, false);
  });
});

describe("custom apex cross-surface URLs", () => {
  it("WRS-CAX-04 marketing ingress portal.alpine.club → alpine.club", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "portal.alpine.club",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://alpine.club:3002"
    );
  });

  it("WRS-CAX-05 marketing ingress alpine.club stays on apex", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "alpine.club",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://alpine.club:3002"
    );
  });

  it("WRS-CAX-06 portal egress from alpine.club → portal.alpine.club", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "alpine.club",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.alpine.club:3003"
    );
  });

  it("WRS-CAX-07 portal ingress stays on portal host", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "portal.alpine.club:3003",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.alpine.club:3003"
    );
  });

  it("WRS-CAX-08 prod custom apex uses https without port", () => {
    assert.equal(
      formatCustomApexSurfaceUrl({
        host: "portal.alpine.club",
        port: "3003",
        rootDomain: "example.com",
      }),
      "https://portal.alpine.club"
    );
  });
});
