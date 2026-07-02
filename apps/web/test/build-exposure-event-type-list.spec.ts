import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExposureEventTypeList } from "@/exposure/build-exposure-event-type-list";
import type { IntegrationConnectionPublic } from "@/integrations/integrations-types";

function sampleConnection(
  overrides: Partial<IntegrationConnectionPublic> = {},
): IntegrationConnectionPublic {
  return {
    id: "conn-1",
    tenantId: "tenant-a",
    workspaceType: "denali",
    provider: "telegram",
    status: "enabled",
    enabled: true,
    capabilities: ["message.send"],
    config: {},
    hasSecret: true,
    secretRefMasked: "masked",
    eventPolicies: [],
    exposureIntents: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    backingSource: "integration_connection",
    legacySourceId: null,
    actionsAllowed: {
      enable: true,
      disable: true,
      test: true,
      patch: true,
      delete: true,
    },
    isActiveDeliverySource: true,
    fallbackSuppressed: false,
    ...overrides,
  };
}

describe("buildExposureEventTypeList", () => {
  it("falls back to TourPublished for telegram when no policies or intents exist", () => {
    assert.deepEqual(buildExposureEventTypeList(sampleConnection(), null), ["TourPublished"]);
  });

  it("uses provider surface defaults for active catalog events", () => {
    const events = buildExposureEventTypeList(sampleConnection(), {
      id: "telegram",
      configFields: [],
      credentialFields: [],
      defaultEventPolicies: [{ eventType: "TourPublished", enabled: true }],
      defaultCapabilities: ["message.send"],
    });
    assert.deepEqual(events, ["TourPublished"]);
  });

  it("merges non-deprecated policies and intents but skips deprecated TourCreated", () => {
    const events = buildExposureEventTypeList(
      sampleConnection({
        eventPolicies: [
          { eventType: "TourCreated", enabled: true, deprecated: true, supersededBy: "TourPublished" },
          { eventType: "TourPublished", enabled: true },
        ],
        exposureIntents: [
          {
            id: "intent-1",
            workspaceType: "denali",
            connectionId: "conn-1",
            eventType: "TourPublished",
            enabled: true,
            selectedFieldIds: ["title"],
            surface: "telegram",
            audience: "external_channel",
            trigger: "TourPublished",
            routeScoped: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      {
        id: "telegram",
        configFields: [],
        credentialFields: [],
        defaultEventPolicies: [{ eventType: "TourPublished", enabled: true }],
        defaultCapabilities: ["message.send"],
      },
    );
    assert.deepEqual(events, ["TourPublished"]);
  });

  it("skips TourCreated from legacy intents when policy marks it deprecated", () => {
    const events = buildExposureEventTypeList(
      sampleConnection({
        eventPolicies: [
          { eventType: "TourCreated", enabled: false, deprecated: true, supersededBy: "TourPublished" },
          { eventType: "TourPublished", enabled: true },
        ],
        exposureIntents: [
          {
            id: "intent-legacy",
            workspaceType: "denali",
            connectionId: "conn-1",
            eventType: "TourCreated",
            enabled: true,
            selectedFieldIds: ["title"],
            surface: "telegram",
            audience: "external_channel",
            trigger: "TourCreated",
            routeScoped: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      {
        id: "telegram",
        configFields: [],
        credentialFields: [],
        defaultEventPolicies: [{ eventType: "TourPublished", enabled: true }],
        defaultCapabilities: ["message.send"],
      },
    );
    assert.deepEqual(events, ["TourPublished"]);
  });
});
