/**
 * PS-6 — More hub presentation threshold (DL-10).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD,
  MEMBER_PORTAL_MORE_ROUTE_PATH,
  resolveMemberPortalHubPresentation,
  resolveMemberPortalSecondaryModules,
  shouldRenderMemberPortalMoreHub,
} from "../src/portal/resolve-member-portal-hub";

describe("resolve-member-portal-hub.spec.ts — workspace-sdk", () => {
  it("SDK-PS6-HUB-01 Denali has no secondary modules today", () => {
    assert.deepEqual(resolveMemberPortalSecondaryModules("denali"), []);
    assert.equal(shouldRenderMemberPortalMoreHub(0), false);
  });

  it("SDK-PS6-HUB-02 plain mode below virtualisation threshold", () => {
    const presentation = resolveMemberPortalHubPresentation(3);
    assert.equal(presentation.mode, "plain");
    assert.equal(presentation.moduleCount, 3);
    assert.equal(presentation.threshold, MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD);
  });

  it("SDK-PS6-HUB-03 virtualised mode at threshold", () => {
    const presentation = resolveMemberPortalHubPresentation(
      MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD
    );
    assert.equal(presentation.mode, "virtualised");
  });

  it("SDK-PS6-HUB-04 more route path is platform-owned", () => {
    assert.equal(MEMBER_PORTAL_MORE_ROUTE_PATH, "/me/more");
  });
});
