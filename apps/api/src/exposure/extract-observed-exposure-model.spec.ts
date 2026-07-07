import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExposureDecision } from "@app-tour/platform-core";

import { extractObservedExposureModel } from "./extract-observed-exposure-model";

function shadowDecision(state: ExposureDecision["state"] = "visible"): ExposureDecision {
  return {
    state,
    reasonChain: [],
    appliedPolicies: [],
  };
}

describe("extractObservedExposureModel", () => {
  it("aggregates surfaces, triggers, clusters, biases, and coverage gaps", () => {
    const model = extractObservedExposureModel({
      surfaces: ["telegram"],
      triggers: ["tour_created"],
      fieldArtifacts: [
        {
          fieldId: "title",
          legacyEligible: true,
          legacyCandidate: true,
          shadowDecision: shadowDecision("visible"),
          driftClassification: null,
          policyHypothesis: null,
        },
        {
          fieldId: "meetingPoint",
          legacyEligible: false,
          legacyCandidate: false,
          shadowDecision: shadowDecision("visible"),
          driftClassification: {
            type: "LEGACY_DELIVERABLE_TAG_DRIVEN",
            confidence: 0.86,
            explanationChain: ["registry_deliverable_tag_present"],
          },
          policyHypothesis: {
            inferredPolicyType: "DELIVERABLE_LEGACY_LEAK",
            suggestedRuleShape: { state: "visible" },
            confidence: 0.8,
            explanationChain: ["hypothesis:non_authoritative"],
          },
        },
      ],
      registrySnapshot: [
        { fieldId: "title", exists: true, tags: ["deliverable"] },
        { fieldId: "meetingPoint", exists: true, tags: ["deliverable"] },
      ],
      fieldPolicySnapshot: { rules: [] },
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
    });

    assert.deepEqual(model.surfaces, ["telegram"]);
    assert.deepEqual(model.triggers, ["tour_created"]);
    assert.equal(model.fieldClusters.length, 2);
    assert.ok(
      model.inferredSystemBiases.some((bias) => bias.type === "TELEGRAM_CENTRICITY"),
    );
    assert.ok(
      model.inferredSystemBiases.some((bias) => bias.type === "DELIVERABLE_TAG_LEAK"),
    );
    assert.ok(
      model.coverageGaps.some((gap) =>
        gap.startsWith("deliverable_catalog_fields_not_legacy_selected:"),
      ),
    );
  });

  it("detects field policy underuse when most fields lack policy rules", () => {
    const model = extractObservedExposureModel({
      surfaces: ["telegram"],
      triggers: ["tour_created"],
      fieldArtifacts: [
        {
          fieldId: "title",
          legacyEligible: false,
          legacyCandidate: false,
          shadowDecision: shadowDecision("visible"),
          driftClassification: {
            type: "UNKNOWN",
            confidence: 0.4,
            explanationChain: [],
          },
          policyHypothesis: null,
        },
        {
          fieldId: "meetingPoint",
          legacyEligible: false,
          legacyCandidate: false,
          shadowDecision: shadowDecision("visible"),
          driftClassification: {
            type: "UNKNOWN",
            confidence: 0.4,
            explanationChain: [],
          },
          policyHypothesis: null,
        },
      ],
      registrySnapshot: [
        { fieldId: "title", exists: true, tags: ["deliverable"] },
        { fieldId: "meetingPoint", exists: true, tags: ["deliverable"] },
      ],
      fieldPolicySnapshot: { rules: [] },
      legacyEligibleFieldIds: [],
      legacyCandidateFieldIds: [],
    });

    assert.ok(
      model.inferredSystemBiases.some((bias) => bias.type === "FIELD_POLICY_UNDERUSE"),
    );
  });
});
