/**
 * PS-5 — shell nav ∩ entitlements
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePortalMemberNavForPlugin } from "../src/shell/resolve-portal-member-nav.server";

describe("resolve-portal-member-nav.server — PS-5 entitlements", () => {
  it("PS5-NAV-01 grant-all shows home + trips primary nav for Denali", () => {
    const nav = resolvePortalMemberNavForPlugin("denali", [
      "member.module.home",
      "member.module.trips",
      "member.module.profile",
    ]);
    assert.equal(nav.primaryNav.length, 2);
    assert.equal(nav.bottomNav.length, 3);
    assert.ok(nav.primaryNav.some((item) => item.testId === "portal-shell-nav-home"));
    assert.ok(nav.primaryNav.some((item) => item.testId === "portal-shell-nav-trips"));
    assert.ok(nav.bottomNav.some((item) => item.testId === "portal-shell-nav-profile"));
    assert.equal(nav.userMenuNav.length, 1);
    assert.equal(nav.userMenuNav[0]?.testId, "portal-shell-user-menu-profile");
  });

  it("PS5-NAV-02 excludes modules missing from granted set", () => {
    const nav = resolvePortalMemberNavForPlugin("denali", [
      "member.module.trips",
      "member.module.profile",
    ]);
    assert.ok(!nav.primaryNav.some((item) => item.testId === "portal-shell-nav-home"));
    assert.ok(nav.primaryNav.some((item) => item.testId === "portal-shell-nav-trips"));
  });

  it("PS5-NAV-03 empty granted yields empty nav (fail-closed)", () => {
    const nav = resolvePortalMemberNavForPlugin("denali", []);
    assert.equal(nav.primaryNav.length, 0);
    assert.equal(nav.hubNav.length, 0);
    assert.equal(nav.userMenuNav.length, 0);
  });

  it("PS6-NAV-01 Denali has empty hub nav without secondary modules", () => {
    const nav = resolvePortalMemberNavForPlugin("denali", [
      "member.module.home",
      "member.module.trips",
      "member.module.profile",
    ]);
    assert.equal(nav.hubNav.length, 0);
    assert.ok(!nav.primaryNav.some((item) => item.testId === "portal-shell-nav-more"));
  });
});
