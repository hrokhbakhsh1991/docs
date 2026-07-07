import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConnectionExposureIntentUpsert } from "./patch-connection-exposure-intent";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "./exposure-intent";

describe("patch-connection-exposure-intent", () => {
  it("maps enabled override into native exposure intent upsert", () => {
    const upsert = buildConnectionExposureIntentUpsert({
      tenantId: "tenant-a",
      workspaceType: "denali",
      provider: "telegram",
      connectionId: "conn-1",
      eventType: "TourCreated",
      selectedFieldIds: ["title"],
      templateId: "New: {{field:title}}",
      enabled: true,
      updatedByUserId: "user-1",
    });
    assert.ok(upsert);
    assert.equal(upsert?.mode, "override_fields");
    assert.deepEqual(upsert?.selectedFieldIds, ["title"]);
    assert.equal(upsert?.templateOverrideId, "New: {{field:title}}");
    assert.equal(upsert?.surface, "telegram");
    assert.equal(upsert?.trigger, "TourCreated");
    assert.equal(upsert?.scope.connectionId, "conn-1");
    assert.equal(upsert?.scope.eventType, "TourCreated");
    assert.equal(upsert?.updatedByUserId, "user-1");
    assert.notEqual(upsert?.profileId, "");
  });

  it("maps inherit profile when override disabled", () => {
    const upsert = buildConnectionExposureIntentUpsert({
      tenantId: "tenant-a",
      workspaceType: "denali",
      provider: "telegram",
      connectionId: "conn-1",
      eventType: "TourCreated",
      selectedFieldIds: [],
      enabled: false,
    });
    assert.ok(upsert);
    assert.equal(upsert?.mode, "inherit_profile");
    assert.equal(upsert?.selectedFieldIds, null);
    assert.equal(upsert?.templateOverrideId, null);
  });

  it("honors explicit surface, audience, and trigger overrides", () => {
    const upsert = buildConnectionExposureIntentUpsert({
      tenantId: "tenant-a",
      workspaceType: "denali",
      provider: "telegram",
      connectionId: "conn-1",
      eventType: "TourCreated",
      selectedFieldIds: ["title"],
      enabled: true,
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourPublished",
    });
    assert.ok(upsert);
    assert.equal(upsert?.surface, "telegram");
    assert.equal(upsert?.audience, "external_channel");
    assert.equal(upsert?.trigger, "TourPublished");
    assert.equal(upsert?.profileId, "denali.telegram.TourPublished");
    assert.deepEqual(upsert?.scope, {
      connectionId: "conn-1",
      eventType: "TourCreated",
    });
  });

  it("returns null upsert when workspace type is missing", () => {
    const upsert = buildConnectionExposureIntentUpsert({
      tenantId: "tenant-a",
      workspaceType: null,
      provider: "telegram",
      connectionId: "conn-1",
      eventType: "TourCreated",
      selectedFieldIds: ["title"],
      enabled: true,
    });
    assert.equal(upsert, null);
  });

  it("uses native exposure intent source constant", () => {
    assert.equal(NATIVE_EXPOSURE_INTENT_SOURCE, "native");
  });
});
