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
    const parsed = tryParseCustomApexHost("denali.club", "localhost", new Set());
    assert.equal(parsed.matched, true);
    if (parsed.matched) {
      assert.equal(parsed.surface, "marketing_apex");
      assert.equal(parsed.apex, "denali.club");
    }
  });

  it("WRS-CAX-02 detects portal custom apex sibling", () => {
    const parsed = tryParseCustomApexHost("portal.denali.club", "localhost", new Set());
    assert.equal(parsed.matched, true);
    if (parsed.matched) {
      assert.equal(parsed.surface, "portal");
      assert.equal(parsed.apex, "denali.club");
    }
  });

  it("WRS-CAX-03 ignores platform club apex", () => {
    const parsed = tryParseCustomApexHost("operator.localhost", "localhost", new Set());
    assert.equal(parsed.matched, false);
  });
});

describe("custom apex cross-surface URLs", () => {
  it("WRS-CAX-04 marketing ingress portal.denali.club → denali.club", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "portal.denali.club",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://denali.club:3002"
    );
  });

  it("WRS-CAX-05 marketing ingress denali.club stays on apex", () => {
    assert.equal(
      buildDevMarketingPublicBaseUrl({
        ingressHost: "denali.club",
        rootDomain: "localhost",
        marketingPort: "3002",
      }),
      "http://denali.club:3002"
    );
  });

  it("WRS-CAX-06 portal egress from denali.club → portal.denali.club", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "denali.club",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.denali.club:3003"
    );
  });

  it("WRS-CAX-07 portal ingress stays on portal host", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "portal.denali.club:3003",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.denali.club:3003"
    );
  });

  it("WRS-CAX-08 prod custom apex uses https without port", () => {
    assert.equal(
      formatCustomApexSurfaceUrl({
        host: "portal.denali.club",
        port: "3003",
        rootDomain: "example.com",
      }),
      "https://portal.denali.club"
    );
  });
});
