/**
 * P4-B — portal host URL resolution
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-01…PR-02)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingTourDetailUrl } from "../src/marketing/resolve-marketing-public-url";

function resolvePortalPublicBaseUrl(host: string): string {
  const configured = process.env.PORTAL_PUBLIC_BASE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = process.env.PORTAL_DEV_PORT?.trim() || "3003";
  const portalHost = hostname.startsWith("shop.") ? hostname.slice("shop.".length) : hostname;
  return `http://${portalHost}:${port}`;
}

describe("resolve-portal-base-url", () => {
  it("PTL-01 marketing shop host maps to portal base", () => {
    assert.equal(
      resolvePortalPublicBaseUrl("shop.denali.localhost:3002"),
      "http://denali.localhost:3003"
    );
  });

  it("PTL-02 marketing back-link uses shop prefix", () => {
    assert.equal(
      resolveMarketingTourDetailUrl("denali.localhost:3003", "tour-abc"),
      "http://shop.denali.localhost:3002/tours/tour-abc"
    );
  });
});
