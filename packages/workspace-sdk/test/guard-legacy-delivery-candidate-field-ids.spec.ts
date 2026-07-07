import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNoLegacyDeliveryCandidateFieldIds,
  LEGACY_FIELD_CANDIDATE_USAGE_DETECTED,
  validateFieldPolicyManifest,
  type WorkspaceFieldPolicyManifest,
} from "../src/registry/index.js";
import { starterWorkspacePlugin } from "../src/reference/starter-workspace.plugin.js";

describe("legacy deliveryCandidateFieldIds guard", () => {
  it("rejects manifests that still declare deliveryCandidateFieldIds", () => {
    const legacyManifest = {
      ...starterWorkspacePlugin.fieldPolicy!,
      deliveryCandidateFieldIds: ["basics.title"],
    } as WorkspaceFieldPolicyManifest & { deliveryCandidateFieldIds: readonly string[] };

    const knownFieldIds = new Set(
      starterWorkspacePlugin.fieldRegistry.fields.map((field) => field.id),
    );

    assert.throws(
      () => validateFieldPolicyManifest(legacyManifest, knownFieldIds),
      new RegExp(LEGACY_FIELD_CANDIDATE_USAGE_DETECTED),
    );
  });

  it("throws from assertNoLegacyDeliveryCandidateFieldIds with context", () => {
    assert.throws(
      () =>
        assertNoLegacyDeliveryCandidateFieldIds(
          { deliveryCandidateFieldIds: ["title"] },
          "unit_test",
        ),
      /LEGACY_FIELD_CANDIDATE_USAGE_DETECTED:unit_test/,
    );
  });
});
