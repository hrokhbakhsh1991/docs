import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevPortalPublicBaseUrl } from "../src/host/build-dev-portal-public-base-url";

describe("buildDevPortalPublicBaseUrl", () => {
  it("maps shop marketing host to inverted club portal on localhost", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "shop.operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.operator.localhost:3003"
    );
  });

  it("maps club apex marketing host to portal.{club}.localhost", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.operator.localhost:3003"
    );
  });

  it("passes through legacy club_portal host unchanged", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "operator.portal.localhost:3003",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://operator.portal.localhost:3003"
    );
  });

  it("passes through inverted club_portal host unchanged", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "portal.operator.localhost:3003",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.operator.localhost:3003"
    );
  });

  it("honors PORTAL_PUBLIC_BASE_URL override via configuredBaseUrl", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "shop.operator.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
        configuredBaseUrl: "https://portal.alpine.club",
      }),
      "https://portal.alpine.club"
    );
  });

  it("WRS-CAX-09 custom apex marketing host maps to portal sibling", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "alpine.club",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.alpine.club:3003"
    );
  });
});
