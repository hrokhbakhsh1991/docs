import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptWorkspaceFieldPolicyManifest } from "../../../src/field-policy/adapters/workspace-field-policy-manifest.js";
import { starterWorkspacePlugin } from "@app-tour/workspace-sdk";
import type { WorkspaceFieldPolicyManifest } from "@app-tour/workspace-sdk/registry";

const STARTER_FIELD_POLICY_MANIFEST = starterWorkspacePlugin.fieldPolicy!;

describe("adaptWorkspaceFieldPolicyManifest", () => {
  it("maps SDK manifest into platform definitions and rules", () => {
    const adapted = adaptWorkspaceFieldPolicyManifest({
      workspaceType: "starter",
      manifest: STARTER_FIELD_POLICY_MANIFEST,
      fieldRegistry: starterWorkspacePlugin.fieldRegistry,
    });

    assert.equal(adapted.definitions.length, 4);
    assert.equal(adapted.rules.length, 5);
    assert.equal(adapted.definitions[0]?.workspaceType, "starter");
    assert.equal(adapted.rules[0]?.workspaceType, "starter");
    assert.equal(adapted.rules[0]?.surface, "public_website");
  });

  it("fills missing definitions from fieldRegistry for referenced registry ids", () => {
    const manifest: WorkspaceFieldPolicyManifest = {
      manifestVersion: 1,
      definitions: [],
      rules: [
        {
          id: "delivery-title",
          fieldId: "basics.title",
          surface: "delivery",
          state: "visible",
          condition: { kind: "always" },
          priority: 1,
          enabled: true,
        },
      ],
    };

    const adapted = adaptWorkspaceFieldPolicyManifest({
      workspaceType: "starter",
      manifest,
      fieldRegistry: starterWorkspacePlugin.fieldRegistry,
    });

    assert.equal(adapted.definitions.length, 1);
    assert.equal(adapted.definitions[0]?.id, "basics.title");
    assert.equal(adapted.definitions[0]?.canonicalPath, "basics.title");
  });

  it("fills missing definitions from fieldRegistry for runtime candidate ids", () => {
    const manifest: WorkspaceFieldPolicyManifest = {
      manifestVersion: 1,
      definitions: [],
      rules: [],
    };

    const adapted = adaptWorkspaceFieldPolicyManifest({
      workspaceType: "starter",
      manifest,
      fieldRegistry: starterWorkspacePlugin.fieldRegistry,
      candidateFieldIds: ["details.summary"],
    });

    assert.equal(adapted.definitions.length, 1);
    assert.equal(adapted.definitions[0]?.id, "details.summary");
    assert.equal(adapted.definitions[0]?.canonicalPath, "details.summary");
  });

  it("rejects legacy deliveryCandidateFieldIds on adapt", () => {
    const legacyManifest = {
      ...STARTER_FIELD_POLICY_MANIFEST,
      deliveryCandidateFieldIds: ["basics.title"],
    } as WorkspaceFieldPolicyManifest & { deliveryCandidateFieldIds: readonly string[] };

    assert.throws(
      () =>
        adaptWorkspaceFieldPolicyManifest({
          workspaceType: "starter",
          manifest: legacyManifest,
          fieldRegistry: starterWorkspacePlugin.fieldRegistry,
        }),
      /LEGACY_FIELD_CANDIDATE_USAGE_DETECTED/,
    );
  });
});
