import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExposureDecision } from "@app-tour/platform-core";

import { classifyShadowDrift } from "./classify-shadow-drift";

function shadowDecision(state: ExposureDecision["state"] = "visible"): ExposureDecision {
  return {
    state,
    reasonChain: [],
    appliedPolicies: [],
  };
}

describe("classifyShadowDrift", () => {
  it("returns null when there is no mismatch", () => {
    const result = classifyShadowDrift({
      fieldId: "title",
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecision: shadowDecision("visible"),
      registryField: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicy: { rules: [] },
      mismatch: null,
      shadowSurface: "telegram",
      normalizedTriggerName: "tour_created",
      rawEventType: "TourCreated",
    });

    assert.equal(result, null);
  });

  it("classifies deliverable catalog drift when legacy did not select the field", () => {
    const result = classifyShadowDrift({
      fieldId: "title",
      legacyEligibleFieldIds: [],
      legacyCandidateFieldIds: [],
      shadowDecision: shadowDecision("visible"),
      registryField: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicy: { rules: [] },
      mismatch: "FIELD_MISSING",
      shadowSurface: "telegram",
      normalizedTriggerName: "tour_created",
      rawEventType: "TourCreated",
    });

    assert.equal(result?.type, "LEGACY_DELIVERABLE_TAG_DRIVEN");
    assert.ok(result?.explanationChain.includes("registry_deliverable_tag_present"));
  });

  it("classifies field policy drift when candidate exists but eligibility was removed", () => {
    const result = classifyShadowDrift({
      fieldId: "title",
      legacyEligibleFieldIds: [],
      legacyCandidateFieldIds: ["title"],
      shadowDecision: shadowDecision("visible"),
      registryField: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicy: {
        rules: [
          {
            id: "rule.hidden",
            fieldId: "title",
            surface: "telegram",
            state: "hidden",
            enabled: true,
          },
        ],
      },
      mismatch: "FIELD_MISSING",
      shadowSurface: "telegram",
      normalizedTriggerName: "tour_created",
      rawEventType: "TourCreated",
    });

    assert.equal(result?.type, "FIELD_POLICY_DRIVEN");
  });

  it("classifies trigger normalization drift for known integration events", () => {
    const result = classifyShadowDrift({
      fieldId: "title",
      legacyEligibleFieldIds: ["title"],
      legacyCandidateFieldIds: ["title"],
      shadowDecision: shadowDecision("redacted"),
      registryField: { fieldId: "title", exists: true, tags: ["deliverable"] },
      fieldPolicy: { rules: [] },
      mismatch: "STATE_MISMATCH",
      shadowSurface: "telegram",
      normalizedTriggerName: "tour_created",
      rawEventType: "TourCreated",
    });

    assert.ok(
      result?.explanationChain.some((line) => line.includes("normalized_trigger:tour_created")),
    );
  });
});
