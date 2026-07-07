import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveActiveDeliveryFieldIds } from "./resolve-active-delivery-field-ids";

const FIELD_EXPOSURE_DECISION = {
  profileId: "denali.telegram.TourCreated",
  profileVersion: "v1",
  resolverVersion: "8.0.0" as const,
  selectionSource: "exposure_profile_defaults" as const,
  candidateFieldIds: ["legacy.title", "engine.title"],
  eligibleFieldIds: ["legacy.title"],
  engineSelectedFieldIds: ["engine.title"],
};

describe("resolveActiveDeliveryFieldIds", () => {
  it("uses engine-selected ids regardless of historical accepted scope metadata", () => {
    assert.deepEqual(
      resolveActiveDeliveryFieldIds({
        fieldExposureDecision: FIELD_EXPOSURE_DECISION,
      }),
      {
        fieldIds: ["engine.title"],
        engineSelectorMissing: false,
      },
    );
  });

  it("emits empty active ids when engine-selected ids are missing", () => {
    assert.deepEqual(
      resolveActiveDeliveryFieldIds({
        fieldExposureDecision: {
          ...FIELD_EXPOSURE_DECISION,
          engineSelectedFieldIds: undefined,
        },
      }),
      {
        fieldIds: [],
        engineSelectorMissing: true,
      },
    );
  });
});
