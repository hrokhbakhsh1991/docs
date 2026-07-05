/**
 * PS-4 — guest cross-surface nav validation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateGuestCrossSurfaceNavLinks,
  type GuestCrossSurfaceNavLink,
} from "../src/catalog/guest-cross-surface-nav";
import { resolveGuestCrossSurfaceNav } from "../src/catalog/resolve-guest-cross-surface-nav";

describe("guest-cross-surface-nav.spec.ts — workspace-sdk", () => {
  const clubLinks: readonly GuestCrossSurfaceNavLink[] = [
    { id: "home", labelKey: "nav.home", surface: "marketing", path: "/" },
    { id: "tours", labelKey: "nav.tours", surface: "marketing", path: "/tours" },
    {
      id: "my-trips",
      labelKey: "nav.myTrips",
      surface: "portal_egress",
      egress: "member_module",
      memberModuleId: "trips",
      visibleWhen: "always",
    },
  ];

  it("SDK-PS4-01 validateGuestCrossSurfaceNavLinks accepts Denali binding", () => {
    assert.doesNotThrow(() => validateGuestCrossSurfaceNavLinks(clubLinks));
  });

  it("SDK-PS6-GCSN-01 rejects member_module egress without memberModuleId", () => {
    assert.throws(
      () =>
        validateGuestCrossSurfaceNavLinks([
          {
            id: "my-trips",
            labelKey: "nav.myTrips",
            surface: "portal_egress",
            egress: "member_module",
          },
        ]),
      /GCSN-MISSING-MEMBER-MODULE-ID/
    );
  });

  it("SDK-PS4-02 rejects club-visible platform-mother path", () => {
    assert.throws(
      () =>
        validateGuestCrossSurfaceNavLinks([
          {
            id: "about",
            labelKey: "nav.about",
            surface: "marketing",
            path: "/about",
            visibleWhen: "club",
          },
        ]),
      /GCSN-404-RISK/
    );
  });

  it("SDK-PS4-03 resolveGuestCrossSurfaceNav returns denali manifest", () => {
    const surface = resolveGuestCrossSurfaceNav("denali");
    assert.ok(surface);
    assert.equal(surface?.links.length, 3);
  });
});
