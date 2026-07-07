import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExposureDecision } from "@app-tour/platform-core";

import type { DriftClassification } from "./classify-shadow-drift";
import { inferExposurePolicyHypothesis } from "./infer-exposure-policy-hypothesis";

function shadowDecision(state: ExposureDecision["state"] = "visible"): ExposureDecision {
  return {
    state,
    reasonChain: [],
    appliedPolicies: [],
  };
}

function drift(type: DriftClassification["type"]): DriftClassification {
  return {
    type,
    confidence: 0.85,
    explanationChain: [`classified_as:${type}`],
  };
}

describe("inferExposurePolicyHypothesis", () => {
  it("returns null when drift classification is absent", () => {
    const result = inferExposurePolicyHypothesis({
      fieldId: "title",
      legacyEligible: true,
      legacyCandidate: true,
      shadowDecision: shadowDecision("visible"),
      driftClassification: null,
      registrySnapshot: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicySnapshot: { rules: [] },
      surface: "telegram",
      audience: "external_channel",
      trigger: "tour_created",
    });

    assert.equal(result, null);
  });

  it("infers deliverable legacy leak hypothesis from drift signal", () => {
    const result = inferExposurePolicyHypothesis({
      fieldId: "title",
      legacyEligible: false,
      legacyCandidate: false,
      shadowDecision: shadowDecision("visible"),
      driftClassification: drift("LEGACY_DELIVERABLE_TAG_DRIVEN"),
      registrySnapshot: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicySnapshot: { rules: [] },
      surface: "telegram",
      audience: "external_channel",
      trigger: "tour_created",
    });

    assert.equal(result?.inferredPolicyType, "DELIVERABLE_LEGACY_LEAK");
    assert.equal(result?.suggestedRuleShape.state, "visible");
    assert.ok(result?.explanationChain.includes("hypothesis:non_authoritative"));
  });

  it("infers field policy constraint hypothesis from policy-driven drift", () => {
    const result = inferExposurePolicyHypothesis({
      fieldId: "title",
      legacyEligible: false,
      legacyCandidate: true,
      shadowDecision: shadowDecision("visible"),
      driftClassification: drift("FIELD_POLICY_DRIVEN"),
      registrySnapshot: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicySnapshot: {
        rules: [
          {
            id: "denali.telegram.title",
            fieldId: "title",
            surface: "telegram",
            state: "hidden",
            enabled: true,
          },
        ],
      },
      surface: "telegram",
      audience: "external_channel",
      trigger: "tour_created",
    });

    assert.equal(result?.inferredPolicyType, "FIELD_POLICY_CONSTRAINT");
    assert.equal(result?.suggestedRuleShape.state, "hidden");
    assert.equal(result?.suggestedRuleShape.surface, "telegram");
  });

  it("infers trigger rule hypothesis from trigger drift", () => {
    const result = inferExposurePolicyHypothesis({
      fieldId: "title",
      legacyEligible: true,
      legacyCandidate: true,
      shadowDecision: shadowDecision("redacted"),
      driftClassification: drift("TRIGGER_MISMATCH"),
      registrySnapshot: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicySnapshot: { rules: [] },
      surface: "telegram",
      audience: "external_channel",
      trigger: "tour_created",
    });

    assert.equal(result?.inferredPolicyType, "TRIGGER_RULE");
    assert.equal(result?.suggestedRuleShape.trigger, "tour_created");
  });
});
