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
  it("falls back to TourCreated for telegram when no policies or intents exist", () => {
    assert.deepEqual(buildExposureEventTypeList(sampleConnection(), null), ["TourCreated"]);
  });

  it("merges provider defaults, connection policies, and exposure intents", () => {
    const events = buildExposureEventTypeList(
      sampleConnection({
        eventPolicies: [{ eventType: "TourCreated", enabled: true }],
        exposureIntents: [
          {
            eventType: "TourCreated",
            enabled: true,
            selectedFieldIds: ["title"],
            surface: "telegram",
            audience: "external_channel",
            trigger: "TourCreated",
          },
        ],
      }),
      {
        id: "telegram",
        configFields: [],
        credentialFields: [],
        defaultEventPolicies: [{ eventType: "TourCreated", enabled: true }],
        defaultCapabilities: ["message.send"],
      },
    );
    assert.deepEqual(events, ["TourCreated"]);
  });
});
