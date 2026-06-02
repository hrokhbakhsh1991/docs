import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_CAPABILITIES } from "./capabilities";
import {
  PRODUCT_CAPABILITY_ALIASES,
  WORKSPACE_CAPABILITY_VALUES,
  normalizeProductCapabilityId,
  allowedRegionIdsFromGrantContext,
  hasRegionalTourManageCapability,
  resolveEffectiveCapabilities,
} from "./capability-registry";
import { WorkspaceRole } from "./workspace-roles";

test("normalizeProductCapabilityId resolves product aliases", () => {
  assert.equal(normalizeProductCapabilityId("tour.form.architect"), "tour.update.tripDetails");
  assert.equal(
    normalizeProductCapabilityId("finance.reconciliation.review"),
    "tour.read",
  );
});

test("resolveEffectiveCapabilities unions role tier and explicit grants", () => {
  const caps = resolveEffectiveCapabilities({
    role: WorkspaceRole.Member,
    capabilities: ["tour.update.core"],
  });
  assert.equal(caps.includes("tour.read"), true);
  assert.equal(caps.includes("tour.update.core"), true);
  assert.equal(caps.includes("tour.publish"), false);
});

test("capabilitiesForTenantModules merges module.finance when finance enabled", () => {
  const caps = resolveEffectiveCapabilities({
    role: "member",
    tenantModules: ["finance"],
  });
  assert.equal(caps.includes("module.finance"), true);
});

test("marketing label club_member resolves to marketing.segment.read", () => {
  const caps = resolveEffectiveCapabilities({
    role: "viewer",
    labels: ["club_member"],
  });
  assert.equal(caps.includes("marketing.segment.read"), true);
});

test("hasRegionalTourManageCapability: owner tier does not enable regional scope", () => {
  assert.equal(
    hasRegionalTourManageCapability({ role: WorkspaceRole.Owner }),
    false,
  );
  assert.equal(
    hasRegionalTourManageCapability({
      role: WorkspaceRole.Member,
      membershipMetadata: { capabilities: ["tour.regional.manage"] },
    }),
    true,
  );
});

test("regional manage + allowedRegionIds from membership metadata", () => {
  const caps = resolveEffectiveCapabilities({
    role: "member",
    membershipMetadata: {
      capabilities: ["tour.regional.manage"],
      allowedRegionIds: ["region-a"],
    },
  });
  assert.equal(caps.includes("tour.regional.manage"), true);
  assert.deepEqual(
    allowedRegionIdsFromGrantContext({
      role: "member",
      membershipMetadata: { allowedRegionIds: ["region-a"] },
    }),
    ["region-a"],
  );
});

test("WORKSPACE_CAPABILITY_VALUES lists all tour and settings capabilities", () => {
  for (const cap of TOUR_CAPABILITIES) {
    assert.equal((WORKSPACE_CAPABILITY_VALUES as readonly string[]).includes(cap), true, cap);
  }
  assert.equal(PRODUCT_CAPABILITY_ALIASES["tour.form.architect"], "tour.update.tripDetails");
});
