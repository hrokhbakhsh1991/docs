import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExposureSelectableFieldCatalog } from "./exposure-field-catalog";
import {
  mapLegacyDeliveryIntentFields,
  resolveLegacyDeliveryExposureProfile,
} from "./legacy-delivery-exposure-mapper";
import { REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED } from "./exposure-profile";

describe("legacy-delivery-exposure-mapper", () => {
  it("resolves seeded profile from provider and domain event", () => {
    const profile = resolveLegacyDeliveryExposureProfile({
      workspaceType: "denali",
      provider: "telegram",
      eventType: "TourCreated",
    });
    const selectableIds = buildExposureSelectableFieldCatalog("denali").map((field) => field.id);

    assert.equal(profile?.id, "denali.telegram.TourCreated");
    assert.equal(profile?.source, REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED);
    assert.deepEqual(profile?.defaultFieldIds, selectableIds);
    assert.equal(profile?.defaultTemplateId, "Tour created: {{title}}");
  });

  it("maps disabled legacy intents to inherit_profile", () => {
    const mapped = mapLegacyDeliveryIntentFields({
      enabled: false,
      selectedFieldIds: ["title"],
      templateId: " hello ",
    });

    assert.equal(mapped.mode, "inherit_profile");
    assert.deepEqual(mapped.selectedFieldIds, []);
    assert.equal(mapped.selectedFieldIdsForStorage, null);
    assert.equal(mapped.templateOverrideId, "hello");
  });
});
