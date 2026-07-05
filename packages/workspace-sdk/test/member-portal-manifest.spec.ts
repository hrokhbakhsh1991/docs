/**
 * PS-2 — SDK member portal manifest validation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateMemberPortalManifest,
  type MemberModuleManifest,
} from "../src/portal/member-module-manifest";

describe("member-portal-manifest.spec.ts — workspace-sdk", () => {
  const tripsModule: MemberModuleManifest = {
    id: "trips",
    routePath: "/me/registrations",
    nav: { tier: "primary", labelKey: "trips" },
  };

  it("SDK-PS2-01 validateMemberPortalManifest accepts Denali Phase 2 binding", () => {
    assert.doesNotThrow(() =>
      validateMemberPortalManifest([tripsModule], "trips")
    );
  });

  it("SDK-PS2-02 rejects reserved module id home", () => {
    assert.throws(
      () =>
        validateMemberPortalManifest(
          [{ ...tripsModule, id: "home", routePath: "/me/home" }],
          "home"
        ),
      /MEMBER_PORTAL_RESERVED_MODULE_ID:home/
    );
  });

  it("SDK-PS2-03 rejects primary tier overflow", () => {
    const modules = Array.from({ length: 6 }, (_, index) => ({
      id: `module_${index}`,
      routePath: `/me/module-${index}`,
      nav: { tier: "primary" as const, labelKey: `module_${index}` },
    }));
    assert.throws(() => validateMemberPortalManifest(modules, "module_0"), /MEMBER_PORTAL_PRIMARY_OVERFLOW/);
  });

  it("SDK-PS2-04 rejects unknown defaultPrimaryModuleId", () => {
    assert.throws(
      () => validateMemberPortalManifest([tripsModule], "wallet"),
      /MEMBER_PORTAL_UNKNOWN_DEFAULT:wallet/
    );
  });
});
