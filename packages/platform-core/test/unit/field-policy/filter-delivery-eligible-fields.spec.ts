import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adaptWorkspaceFieldPolicyManifest,
  filterDeliveryEligibleFields,
  FIELD_POLICY_ENTITY_PATH,
} from "../../../src/field-policy/index.js";
import { starterWorkspacePlugin } from "@app-tour/workspace-sdk/plugin";

const STARTER_FIELD_POLICY_MANIFEST = starterWorkspacePlugin.fieldPolicy!;

describe("filterDeliveryEligibleFields", () => {
  it("drops hidden delivery fields and preserves candidate order", () => {
    const adapted = adaptWorkspaceFieldPolicyManifest({
      workspaceType: "starter",
      manifest: STARTER_FIELD_POLICY_MANIFEST,
      fieldRegistry: starterWorkspacePlugin.fieldRegistry,
    });

    const eligible = filterDeliveryEligibleFields({
      tenantId: "tenant-1",
      workspaceType: "starter",
      exposureSurface: "delivery",
      candidateFieldIds: ["details.summary", "basics.featured", "basics.title"],
      entityState: {},
      definitions: adapted.definitions,
      rules: adapted.rules,
    });

    assert.deepEqual(eligible, ["details.summary", "basics.title"]);
  });

  it("keeps delivery candidates eligible without lifecycle facts when delivery rules use always", () => {
    const adapted = adaptWorkspaceFieldPolicyManifest({
      workspaceType: "starter",
      manifest: STARTER_FIELD_POLICY_MANIFEST,
      fieldRegistry: starterWorkspacePlugin.fieldRegistry,
    });

    const eligible = filterDeliveryEligibleFields({
      tenantId: "tenant-1",
      workspaceType: "starter",
      exposureSurface: "delivery",
      candidateFieldIds: ["basics.title", "details.summary"],
      entityState: {},
      definitions: adapted.definitions,
      rules: adapted.rules,
    });

    assert.deepEqual(eligible, ["basics.title", "details.summary"]);
  });
});

describe("entity state contract", () => {
  it("documents standard path prefixes without expanding DSL", () => {
    assert.equal(FIELD_POLICY_ENTITY_PATH.tour("status"), "tour.status");
    assert.equal(FIELD_POLICY_ENTITY_PATH.dimensions("variant"), "dimensions.variant");
    assert.equal(FIELD_POLICY_ENTITY_PATH.actor("role"), "actor.role");
    assert.equal(
      FIELD_POLICY_ENTITY_PATH.integrations("activeProviderIds"),
      "integrations.activeProviderIds",
    );
  });
});
