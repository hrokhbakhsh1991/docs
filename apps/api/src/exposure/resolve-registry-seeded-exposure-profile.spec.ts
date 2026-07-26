import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExposureSelectableFieldCatalog } from "./exposure-field-catalog";
import {
  DENALI_TELEGRAM_TOUR_PUBLISHED_PROFILE_SLUG,
  REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
} from "./exposure-profile";
import {
  resolveExposureProfileDefaultFieldIds,
  resolveExposureRequestedFieldIds,
  resolveRegistrySeededExposureProfile,
} from "./resolve-registry-seeded-exposure-profile";

describe("resolveRegistrySeededExposureProfile", () => {
  it("returns null without a workspace type", async () => {
    assert.equal(
      await resolveRegistrySeededExposureProfile({
        workspaceType: null,
        entityType: "tour",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
      }),
      null,
    );
  });

  it("seeds Denali telegram TourPublished defaults from deliverable registry tags", async () => {
    const selectableIds = await buildExposureSelectableFieldCatalog("denali").map((field) => field.id);
    const profile = await resolveRegistrySeededExposureProfile({
      workspaceType: "denali",
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourPublished",
    });

    assert.equal(profile?.id, "denali.telegram.TourPublished");
    assert.equal(profile?.source, REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED);
    assert.deepEqual(profile?.defaultFieldIds, selectableIds);
    assert.ok(profile?.defaultFieldIds.includes("title"));
    assert.ok(profile?.defaultFieldIds.includes("denali.destination"));
    assert.equal(profile?.defaultTemplateId, "Tour published: {{title}}");
    assert.equal(
      `${profile?.workspaceType}.${profile?.surface}.${profile?.trigger}`,
      "denali.telegram.TourPublished",
    );
    assert.equal(DENALI_TELEGRAM_TOUR_PUBLISHED_PROFILE_SLUG, "telegram_tour_published");
  });

  it("resolveExposureProfileDefaultFieldIds matches legacy deliverable defaults", async () => {
    assert.deepEqual(
      await resolveExposureProfileDefaultFieldIds("denali"),
      await buildExposureSelectableFieldCatalog("denali").map((field) => field.id),
    );
    assert.deepEqual(await resolveExposureProfileDefaultFieldIds("starter"), [
      "basics.title",
      "details.summary",
    ]);
  });

  it("resolveExposureRequestedFieldIds prefers admin selection over profile defaults", async () => {
    const defaults = await buildExposureSelectableFieldCatalog("denali").map((field) => field.id);
    assert.deepEqual(await resolveExposureRequestedFieldIds(["title"], "denali"), ["title"]);
    assert.deepEqual(await resolveExposureRequestedFieldIds(null, "denali"), defaults);
    assert.deepEqual(await resolveExposureRequestedFieldIds(undefined, "denali"), defaults);
  });
});
