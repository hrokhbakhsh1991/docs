/**
 * PS-2 — generated member portal registry resolver.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isMemberPortalEnabled,
  MemberPortalDisabledError,
  MemberPortalUnknownRouteError,
  listMemberPortalEntitlementKeys,
  resolveMemberPortalContract,
  resolveMemberPortalDefaultRoutePath,
  resolveMemberPortalModuleRoutePath,
  resolveMemberPortalModuleByRoutePath,
  resolveMemberPortalModules,
  tryResolveMemberPortalDefaultRoutePath,
} from "../src/portal/resolve-member-portal-modules";
import { mergePlatformMemberPortalModules } from "../src/portal/platform-member-portal-modules";

describe("resolve-member-portal-modules.spec.ts — workspace-sdk", () => {
  it("SDK-MPC-01 starter contract is off", () => {
    assert.deepEqual(resolveMemberPortalContract("starter"), { availability: "off" });
    assert.equal(isMemberPortalEnabled("starter"), false);
    assert.equal(tryResolveMemberPortalDefaultRoutePath("starter"), null);
  });

  it("SDK-PS2-05 resolveMemberPortalModules returns Denali home + trips + profile + hidden wallet + tickets", () => {
    const surface = resolveMemberPortalModules("denali");
    assert.equal(surface.defaultPrimaryModuleId, "trips");
    assert.equal(surface.modules.length, 5);
    const home = surface.modules.find((module) => module.id === "home");
    assert.ok(home);
    assert.equal(home.routePath, "/me/home");
    assert.equal(home.nav.tier, "primary");
    const trips = surface.modules.find((module) => module.id === "trips");
    assert.ok(trips);
    assert.equal(trips.routePath, "/me/registrations");
    assert.equal(trips.nav.tier, "primary");
  });

  it("SDK-MPC-02 urban minimal contract omits platform home", () => {
    const contract = resolveMemberPortalContract("urban");
    assert.equal(contract.availability, "minimal");
    if (contract.availability === "off") {
      assert.fail("expected minimal");
    }
    assert.equal(
      contract.surface.modules.some((module) => module.id === "home"),
      false
    );
    assert.equal(contract.surface.modules.length, 2);
  });

  it("SDK-PS2-06 resolveMemberPortalDefaultRoutePath returns frozen alias", () => {
    assert.equal(resolveMemberPortalDefaultRoutePath("denali"), "/me/registrations");
  });

  it("SDK-PS2-07 resolveMemberPortalModuleRoutePath resolves profile", () => {
    assert.equal(resolveMemberPortalModuleRoutePath("denali", "profile"), "/me/profile");
  });

  it("SDK-PS2-08 throws MemberPortalDisabledError when availability is off", () => {
    assert.throws(() => resolveMemberPortalModules("starter"), MemberPortalDisabledError);
  });

  it("SDK-PS5-01 resolveMemberPortalModuleRoutePath resolves platform home", () => {
    assert.equal(resolveMemberPortalModuleRoutePath("denali", "home"), "/me/home");
  });

  it("SDK-PS5-02 listMemberPortalEntitlementKeys includes home and workspace modules", () => {
    const keys = listMemberPortalEntitlementKeys("denali");
    assert.deepEqual(keys, [
      "member.module.home",
      "member.module.trips",
      "member.module.profile",
      "member.module.wallet",
      "member.module.tickets",
    ]);
  });

  it("SDK-PS5-03 mergePlatformMemberPortalModules rejects workspace home collision", () => {
    assert.throws(() =>
      mergePlatformMemberPortalModules([
        {
          id: "home",
          routePath: "/me/home",
          nav: { tier: "primary", labelKey: "home" },
        },
      ])
    );
  });

  it("SDK-PS5-04 resolveMemberPortalModuleByRoutePath resolves trips alias", () => {
    const module = resolveMemberPortalModuleByRoutePath("denali", "/me/registrations");
    assert.equal(module.id, "trips");
  });

  it("SDK-PS5-05 resolveMemberPortalModuleByRoutePath throws for unknown route", () => {
    assert.throws(
      () => resolveMemberPortalModuleByRoutePath("denali", "/me/not-a-module"),
      MemberPortalUnknownRouteError
    );
  });

  it("SDK-PS5-06 resolveMemberPortalModuleByRoutePath resolves hidden wallet route", () => {
    const module = resolveMemberPortalModuleByRoutePath("denali", "/me/wallet");
    assert.equal(module.id, "wallet");
    assert.equal(module.nav.tier, "hidden");
  });
});
