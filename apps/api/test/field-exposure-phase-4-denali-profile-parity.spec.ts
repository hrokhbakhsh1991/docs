import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_TELEGRAM_TOUR_CREATED_PROFILE_SLUG } from "../src/exposure/exposure-profile";
import { buildExposureSelectableFieldCatalog } from "../src/exposure/exposure-field-catalog";
import {
  resolveDeliveryExposureProfileContext,
  resolveRegistrySeededExposureProfile,
} from "../src/exposure/resolve-registry-seeded-exposure-profile";

describe("resolveDeliveryExposureProfileContext", () => {
  it("defaults delivery profile context to telegram external channel tour events", () => {
    assert.deepEqual(resolveDeliveryExposureProfileContext(), {
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    });
    assert.deepEqual(resolveDeliveryExposureProfileContext("TourUpdated").trigger, "TourUpdated");
  });
});

describe("Denali telegram tour created profile parity", () => {
  it("matches documented telegram_tour_created slug and template seed", () => {
    const selectableIds = buildExposureSelectableFieldCatalog("denali").map((field) => field.id);
    const profile = resolveRegistrySeededExposureProfile({
      workspaceType: "denali",
      ...resolveDeliveryExposureProfileContext("TourCreated"),
      entityType: "tour",
    });

    assert.equal(profile?.id, "denali.telegram.TourCreated");
    assert.equal(DENALI_TELEGRAM_TOUR_CREATED_PROFILE_SLUG, "telegram_tour_created");
    assert.deepEqual(profile?.defaultFieldIds, selectableIds);
    assert.equal(profile?.defaultTemplateId, "Tour created: {{title}}");
    assert.equal(profile?.source, "registry_deliverable_migration_seed");
  });
});
