import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  workspaceProductionTierLabel,
} from "../src/platform/workspace-production-certification-badge";
import {
  isWorkspaceProductionOnboardingAllowed,
  tryResolveWorkspaceProductionTier,
} from "../src/platform/resolve-workspace-production-tier";

describe("workspace production certification badge (Phase H4)", () => {
  it("resolves denali as certified", () => {
    assert.equal(tryResolveWorkspaceProductionTier("denali"), "certified");
    assert.equal(isWorkspaceProductionOnboardingAllowed("denali"), true);
  });

  it("resolves urban as stub", () => {
    assert.equal(tryResolveWorkspaceProductionTier("urban"), "stub");
    assert.equal(isWorkspaceProductionOnboardingAllowed("urban"), false);
  });

  it("labels tiers for Super Admin badge", () => {
    assert.equal(workspaceProductionTierLabel("certified"), "Certified");
    assert.equal(workspaceProductionTierLabel("stub"), "Stub");
  });
});
