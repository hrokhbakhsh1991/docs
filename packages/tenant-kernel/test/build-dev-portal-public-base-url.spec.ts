import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevPortalPublicBaseUrl } from "../src/host/build-dev-portal-public-base-url";

describe("buildDevPortalPublicBaseUrl", () => {
  it("maps shop marketing host to club portal dev origin", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "shop.operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://operator.portal.localhost:3003"
    );
  });

  it("maps club apex marketing host to portal subdomain", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://operator.portal.localhost:3003"
    );
  });

  it("passes through club_portal host unchanged", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "operator.portal.localhost:3003",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://operator.portal.localhost:3003"
    );
  });

  it("honors PORTAL_PUBLIC_BASE_URL override via configuredBaseUrl", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "shop.operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
        configuredBaseUrl: "https://portal.denali.club",
      }),
      "https://portal.denali.club"
    );
  });
});
