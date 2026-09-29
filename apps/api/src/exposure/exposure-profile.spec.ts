import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
  mergeRegistrySeededExposureProfileDefaults,
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
      null
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

describe("mergeRegistrySeededExposureProfileDefaults", () => {
  it("restores newly eligible fields on an older registry-seeded profile", () => {
    const persisted = resolveSeededExposureProfile({
      workspaceType: "denali",
      entityType: "tour",
      surface: "public_list",
      audience: "public",
      trigger: "always",
      defaultFieldIds: ["title"],
    });
    const seed = resolveSeededExposureProfile({
      workspaceType: "denali",
      entityType: "tour",
      surface: "public_list",
      audience: "public",
      trigger: "always",
      defaultFieldIds: ["title", "denali.transport-mode"],
    });

    assert.deepEqual(
      mergeRegistrySeededExposureProfileDefaults({ persisted, seed })?.defaultFieldIds,
      ["title", "denali.transport-mode"]
    );
  });

  it("does not override native profiles", () => {
    const persisted = resolveSeededExposureProfile({
      workspaceType: "denali",
      entityType: "tour",
      surface: "public_list",
      audience: "public",
      trigger: "always",
      defaultFieldIds: ["title"],
    });
    const native = persisted === null ? null : { ...persisted, source: "native" as const };
    const seed =
      persisted === null ? null : { ...persisted, defaultFieldIds: ["title", "transport"] };

    assert.deepEqual(
      mergeRegistrySeededExposureProfileDefaults({ persisted: native, seed })?.defaultFieldIds,
      ["title"]
    );
  });
});
