import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_TELEGRAM_TOUR_PUBLISHED_PROFILE_SLUG } from "../src/exposure/exposure-profile";
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

describe("Denali telegram tour published profile parity", () => {
  it("matches documented telegram_tour_published slug and template seed", () => {
    const selectableIds = buildExposureSelectableFieldCatalog("denali").map((field) => field.id);
    const profile = resolveRegistrySeededExposureProfile({
      workspaceType: "denali",
      ...resolveDeliveryExposureProfileContext("TourPublished"),
      entityType: "tour",
    });

    assert.equal(profile?.id, "denali.telegram.TourPublished");
    assert.equal(DENALI_TELEGRAM_TOUR_PUBLISHED_PROFILE_SLUG, "telegram_tour_published");
    assert.deepEqual(profile?.defaultFieldIds, selectableIds);
    assert.equal(profile?.defaultTemplateId, "Tour published: {{title}}");
    assert.equal(profile?.source, "registry_deliverable_migration_seed");
  });
});
