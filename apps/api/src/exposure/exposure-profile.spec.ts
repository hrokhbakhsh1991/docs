import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
  resolveSeededExposureProfile,
} from "./exposure-profile";

describe("resolveSeededExposureProfile", () => {
  it("returns null without a workspace type", () => {
    assert.equal(
      resolveSeededExposureProfile({
        workspaceType: null,
        entityType: "tour",
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
        defaultFieldIds: ["title"],
      }),
      null,
    );
  });

  it("wraps migration defaults in a versioned exposure profile view", () => {
    const profile = resolveSeededExposureProfile({
      workspaceType: "denali",
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
      defaultFieldIds: ["title", "denali.destination"],
      defaultTemplateId: "Tour created: {{title}}",
    });

    assert.deepEqual(profile, {
      id: "denali.telegram.TourCreated",
      workspaceType: "denali",
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
      defaultFieldIds: ["title", "denali.destination"],
      defaultTemplateId: "Tour created: {{title}}",
      source: REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
      version: "migration-seed-v1",
    });
  });
});
