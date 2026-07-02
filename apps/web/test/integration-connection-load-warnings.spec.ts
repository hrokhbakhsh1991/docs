import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasIntegrationLoadWarnings,
  listDeprecatedEventPolicies,
  partitionIntegrationLoadWarnings,
} from "@/integrations/integration-connection-load-warnings";
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

describe("integration-connection-load-warnings", () => {
  it("partitions TourPublished policy drift from other load warnings", () => {
    assert.deepEqual(
      partitionIntegrationLoadWarnings([
        "POLICIES_UNAVAILABLE",
        "TOUR_PUBLISHED_POLICY_DRIFT",
      ]),
      {
        tourPublishedPolicyDrift: true,
        other: ["POLICIES_UNAVAILABLE"],
      },
    );
  });

  it("detects when any load warning is present", () => {
    assert.equal(hasIntegrationLoadWarnings(undefined), false);
    assert.equal(hasIntegrationLoadWarnings([]), false);
    assert.equal(hasIntegrationLoadWarnings(["TOUR_PUBLISHED_POLICY_DRIFT"]), true);
  });

  it("lists deprecated event policies on a connection", () => {
    const deprecated = listDeprecatedEventPolicies(
      sampleConnection({
        eventPolicies: [
          { eventType: "TourCreated", enabled: false, deprecated: true, supersededBy: "TourPublished" },
          { eventType: "TourPublished", enabled: true },
        ],
      }),
    );
    assert.equal(deprecated.length, 1);
    assert.equal(deprecated[0]?.eventType, "TourCreated");
    assert.equal(deprecated[0]?.supersededBy, "TourPublished");
  });
});
