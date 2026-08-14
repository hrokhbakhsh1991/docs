/**
 * P4-B — portal host URL resolution
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-01…PR-02)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDevPortalPublicBaseUrl } from "@app-tour/tenant-kernel";

import { resolveMarketingTourDetailUrl } from "../src/marketing/resolve-marketing-public-url";

describe("resolve-portal-base-url", () => {
  it("PTL-01 marketing shop host maps to portal base", () => {
    assert.equal(
      buildDevPortalPublicBaseUrl({
        ingressHost: "shop.denali.localhost:3002",
        rootDomain: "localhost",
        portalPort: "3003",
      }),
      "http://portal.denali.localhost:3003"
    );
  });

  it("PTL-02 marketing back-link uses canonical club apex (no shop prefix)", () => {
    assert.equal(
      resolveMarketingTourDetailUrl("denali.portal.localhost:3003", "tour-abc"),
      "http://denali.localhost:3002/tours/tour-abc"
    );
  });
});
