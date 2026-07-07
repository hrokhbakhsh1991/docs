import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveExposureIntentCandidateFieldIds,
  resolveExposureIntentFieldDecorations,
  resolveExposureIntentTemplateId,
} from "./exposure-intent-delivery-selection";
import { NATIVE_EXPOSURE_INTENT_SOURCE, type ExposureIntent } from "./exposure-intent";

function nativeIntent(overrides: Partial<ExposureIntent> = {}): ExposureIntent {
  return {
    id: "native-1",
    profileId: "denali.telegram.TourCreated",
    workspaceType: "denali",
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: "TourCreated",
    scope: { connectionId: "conn-1" },
    mode: "override_fields",
    selectedFieldIds: ["title"],
    source: NATIVE_EXPOSURE_INTENT_SOURCE,
    sourceId: "native-1",
    version: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExposureIntent delivery selection", () => {
  it("uses profile defaults when intent is absent or inherits profile", () => {
    assert.equal(resolveExposureIntentCandidateFieldIds(null), null);
    assert.equal(
      resolveExposureIntentCandidateFieldIds(
        nativeIntent({ mode: "inherit_profile", selectedFieldIds: ["ignored"] }),
      ),
      null,
    );
  });

  it("uses explicit selected fields for override mode", () => {
    assert.deepEqual(
      resolveExposureIntentCandidateFieldIds(
        nativeIntent({ mode: "override_fields", selectedFieldIds: ["title", "datetime"] }),
      ),
      ["title", "datetime"],
    );
  });

  it("maps disabled exposure to an explicit empty field selection", () => {
    assert.deepEqual(
      resolveExposureIntentCandidateFieldIds(
        nativeIntent({ mode: "disabled", selectedFieldIds: ["ignored"] }),
      ),
      [],
    );
  });

  it("normalizes template overrides", () => {
    assert.equal(resolveExposureIntentTemplateId(null), null);
    assert.equal(resolveExposureIntentTemplateId(nativeIntent({ templateOverrideId: "  " })), null);
    assert.equal(
      resolveExposureIntentTemplateId(nativeIntent({ templateOverrideId: " Custom " })),
      "Custom",
    );
  });

  it("returns intent-scoped field decorations when present", () => {
    assert.equal(resolveExposureIntentFieldDecorations(null), null);
    assert.equal(resolveExposureIntentFieldDecorations(nativeIntent()), null);
    assert.deepEqual(
      resolveExposureIntentFieldDecorations(
        nativeIntent({
          fieldDecorations: {
            meetingPoint: { prefix: "✅ 📍" },
          },
        }),
      ),
      { meetingPoint: { prefix: "✅ 📍" } },
    );
  });
});
