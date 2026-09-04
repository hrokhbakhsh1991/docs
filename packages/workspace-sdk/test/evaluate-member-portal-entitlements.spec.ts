/**
 * PS-6 — tier-aware member portal entitlement evaluation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateMemberPortalEntitlements,
  evaluateMemberPortalEntitlementsForSurface,
} from "../src/portal/evaluate-member-portal-entitlements";
import { mergePlatformMemberPortalModules } from "../src/portal/platform-member-portal-modules";

describe("evaluate-member-portal-entitlements.spec.ts — workspace-sdk", () => {
  it("SDK-PS6-01 Denali default grants visible tiers; hidden wallet denied", () => {
    const evaluation = evaluateMemberPortalEntitlements("denali");
    assert.deepEqual(evaluation.granted, [
      "member.module.home",
      "member.module.trips",
      "member.module.profile",
      "member.module.tickets",
    ]);
    assert.deepEqual(evaluation.denied, [
      { key: "member.module.wallet", reason: "plan_limit" },
    ]);
  });

  it("SDK-PS6-02 hidden tier denied until explicit module grant", () => {
    const surface = {
      manifestVersion: 1 as const,
      defaultPrimaryModuleId: "trips",
      modules: mergePlatformMemberPortalModules([
        {
          id: "trips",
          routePath: "/me/registrations",
          nav: { tier: "primary", labelKey: "trips" },
        },
        {
          id: "wallet",
          routePath: "/me/wallet",
          nav: { tier: "hidden", labelKey: "wallet" },
        },
      ]),
    };
    const withoutGrant = evaluateMemberPortalEntitlementsForSurface(surface);
    assert.ok(withoutGrant.granted.includes("member.module.home"));
    assert.ok(withoutGrant.granted.includes("member.module.trips"));
    assert.ok(!withoutGrant.granted.includes("member.module.wallet"));
    assert.deepEqual(withoutGrant.denied, [
      { key: "member.module.wallet", reason: "plan_limit" },
    ]);

    const withGrant = evaluateMemberPortalEntitlementsForSurface(surface, {
      explicitModuleIds: ["wallet"],
    });
    assert.ok(withGrant.granted.includes("member.module.wallet"));
    assert.deepEqual(withGrant.denied, []);
  });
});
