import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseExposureSimulationDiffResponse,
  parseExposureSimulationResponse,
} from "../src/exposure/exposure-simulation-client";

const BASE_PREVIEW = {
  samplePayload: { status: "published", title: "Engine preview" },
  fields: {
    title: {
      state: "visible",
      reasonChain: ["profile_default"],
      appliedPolicies: ["profile:telegram_tour_created"],
    },
    "details.summary": {
      state: "hidden",
      reasonChain: ["intent_override"],
      appliedPolicies: [],
    },
  },
  summary: {
    visibleCount: 1,
    hiddenCount: 1,
    blockedCount: 0,
  },
  simulation: {
    connectionId: "conn-1",
    eventType: "TourCreated",
    effectiveContext: {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    },
    draftIntentApplied: true,
  },
};

describe("parseExposureSimulationResponse", () => {
  it("preserves preview decisions, sample payload, and simulation metadata", () => {
    const parsed = parseExposureSimulationResponse(BASE_PREVIEW);

    assert.deepEqual(parsed.samplePayload, {
      status: "published",
      title: "Engine preview",
    });
    assert.deepEqual(parsed.engineSelectedFieldIds, ["title"]);
    assert.deepEqual(parsed.simulation.effectiveContext, {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    });
    assert.equal(parsed.simulation.draftIntentApplied, true);
  });
});

describe("parseExposureSimulationDiffResponse", () => {
  it("parses deterministic field and selected-field changes", () => {
    const parsed = parseExposureSimulationDiffResponse({
      current: BASE_PREVIEW,
      simulated: BASE_PREVIEW,
      diff: {
        changedFieldIds: ["details.summary"],
        fieldChanges: [
          {
            fieldId: "details.summary",
            currentState: "visible",
            simulatedState: "hidden",
          },
        ],
        selectedFieldIdsAdded: [],
        selectedFieldIdsRemoved: ["details.summary"],
      },
    });

    assert.deepEqual(parsed.diff, {
      changedFieldIds: ["details.summary"],
      fieldChanges: [
        {
          fieldId: "details.summary",
          currentState: "visible",
          simulatedState: "hidden",
        },
      ],
      selectedFieldIdsAdded: [],
      selectedFieldIdsRemoved: ["details.summary"],
    });
  });
});
