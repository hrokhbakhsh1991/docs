import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSimulatedExposureIntent,
  diffExposureSimulationResponses,
  ExposureSimulationInvalidBodyError,
  parseExposureSimulationRequest,
  type ExposureSimulationResponse,
} from "./exposure-simulation.service";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "./exposure-intent";

function simulation(fields: ExposureSimulationResponse["fields"]): ExposureSimulationResponse {
  return {
    samplePayload: { status: "published" },
    fields,
    summary: {
      visibleCount: Object.values(fields).filter((field) => field.state === "visible").length,
      hiddenCount: Object.values(fields).filter((field) => field.state === "hidden").length,
      blockedCount: Object.values(fields).filter((field) => field.state === "blocked").length,
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
}

describe("buildSimulatedExposureIntent", () => {
  it("overlays draft fields onto a persisted route-scoped intent", () => {
    const persistedIntent = {
      id: "intent-1",
      profileId: "denali.telegram.TourPublished",
      workspaceType: "denali",
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourPublished",
      scope: {
        connectionId: "conn-1",
        eventType: "TourCreated",
      },
      mode: "inherit_profile" as const,
      selectedFieldIds: [],
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: "intent-1",
      version: "2026-01-01T00:00:00.000Z",
    };

    assert.deepEqual(
      buildSimulatedExposureIntent({
        workspaceType: "denali",
        connectionId: "conn-1",
        eventType: "TourCreated",
        effectiveContext: {
          surface: "telegram",
          audience: "external_channel",
          trigger: "TourPublished",
        },
        persistedIntent,
        draftIntent: {
          mode: "override_fields",
          selectedFieldIds: ["title"],
          templateOverrideId: "template-a",
        },
      }),
      {
        ...persistedIntent,
        mode: "override_fields",
        selectedFieldIds: ["title"],
        templateOverrideId: "template-a",
      },
    );
  });
});

describe("parseExposureSimulationRequest", () => {
  it("parses a draft intent overlay without mutating persistence", () => {
    assert.deepEqual(
      parseExposureSimulationRequest({
        connectionId: " conn-1 ",
        eventType: " TourCreated ",
        draftIntent: {
          mode: "override_fields",
          selectedFieldIds: ["title", 7, "details.summary"],
          templateOverrideId: " template-a ",
        },
      }),
      {
        connectionId: "conn-1",
        eventType: "TourCreated",
        draftIntent: {
          mode: "override_fields",
          selectedFieldIds: ["title", "details.summary"],
          templateOverrideId: "template-a",
        },
      },
    );
  });

  it("rejects missing route coordinates", () => {
    assert.throws(
      () => parseExposureSimulationRequest({ connectionId: "", eventType: "TourCreated" }),
      ExposureSimulationInvalidBodyError,
    );
  });
});

describe("diffExposureSimulationResponses", () => {
  it("reports deterministic state and selected-field changes", () => {
    const current = simulation({
      title: { state: "visible", reasonChain: [], appliedPolicies: [] },
      "details.summary": { state: "visible", reasonChain: [], appliedPolicies: [] },
    });
    const simulated = simulation({
      title: { state: "visible", reasonChain: [], appliedPolicies: [] },
      "details.summary": { state: "hidden", reasonChain: [], appliedPolicies: [] },
    });

    assert.deepEqual(diffExposureSimulationResponses({ current, simulated }), {
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
