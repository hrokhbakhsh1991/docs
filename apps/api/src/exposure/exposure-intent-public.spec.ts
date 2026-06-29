import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NATIVE_EXPOSURE_INTENT_SOURCE, type ExposureIntent } from "./exposure-intent";
import {
  mapExposureIntentToConnectionPublic,
  mapLatestExposureIntentsToConnectionPublic,
} from "./exposure-intent-public";

describe("mapExposureIntentToConnectionPublic", () => {
  it("preserves route event type separately from stored trigger", () => {
    const intent: ExposureIntent = {
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
      mode: "override_fields",
      selectedFieldIds: ["title"],
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: "intent-1",
      version: "2026-01-01T00:00:00.000Z",
    };

    assert.deepEqual(mapExposureIntentToConnectionPublic(intent), {
      id: "intent-1",
      workspaceType: "denali",
      connectionId: "conn-1",
      eventType: "TourCreated",
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourPublished",
      selectedFieldIds: ["title"],
      routeScoped: true,
      enabled: true,
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("exposes only the newest row per connection/event route anchor", () => {
    const newest: ExposureIntent = {
      id: "newest",
      profileId: "denali.telegram.PaymentCompleted",
      workspaceType: "denali",
      entityType: "tour",
      surface: "telegram",
      audience: "external_channel",
      trigger: "PaymentCompleted",
      scope: {
        connectionId: "conn-1",
        eventType: "TourCreated",
      },
      mode: "override_fields",
      selectedFieldIds: ["title"],
      source: NATIVE_EXPOSURE_INTENT_SOURCE,
      sourceId: "newest",
      version: "2026-01-02T00:00:00.000Z",
    };
    const older: ExposureIntent = {
      ...newest,
      id: "older",
      sourceId: "older",
      profileId: "denali.telegram.TourPublished",
      trigger: "TourPublished",
      version: "2026-01-01T00:00:00.000Z",
    };

    assert.deepEqual(mapLatestExposureIntentsToConnectionPublic([newest, older]), [
      {
        id: "newest",
        workspaceType: "denali",
        connectionId: "conn-1",
        eventType: "TourCreated",
        surface: "telegram",
        audience: "external_channel",
        trigger: "PaymentCompleted",
        selectedFieldIds: ["title"],
        routeScoped: true,
        enabled: true,
        createdAt: "1970-01-01T00:00:00.000Z",
        updatedAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
  });
});
