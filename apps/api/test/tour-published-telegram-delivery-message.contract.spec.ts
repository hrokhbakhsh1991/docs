import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { dispatchIntegrationDomainEvent } from "../src/integrations/application/dispatch-integration-domain-event";
import {
  resolveIntegrationPolicyExposureCoordinate,
  type IntegrationPolicyEngine,
} from "../src/integrations/application/integration-policy-engine";
import { resolveRegistrySeededExposureProfile } from "../src/exposure/resolve-registry-seeded-exposure-profile";
import { resolvePersistedExposureProfileForContext } from "../src/exposure/resolve-persisted-exposure-profile";
import { formatIntegrationDeliveryMessage } from "../src/integrations/platform/format-integration-delivery-message";

const NATIVE_EXPOSURE_INTENT_SOURCE = "native_exposure_intent" as const;

type EnqueuedJob = {
  payload: Record<string, unknown>;
};

function tourPublishedIntent() {
  return {
    id: "intent-tp-1",
    profileId: "denali.telegram.TourPublished",
    workspaceType: "denali" as const,
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: "TourPublished",
    scope: { connectionId: "conn-1" },
    mode: "override_fields" as const,
    selectedFieldIds: ["denali.destination", "denali.datetime"],
    templateOverrideId: null,
    source: NATIVE_EXPOSURE_INTENT_SOURCE,
    sourceId: "intent-tp-1",
    version: "2026-01-01T00:00:00.000Z",
  };
}

function buildPolicyEngine(
  exposureIntent: ReturnType<typeof tourPublishedIntent>,
): IntegrationPolicyEngine {
  return {
    evaluate: async () => [
      {
        connectionId: "conn-1",
        tenantId: "tenant-a",
        provider: "telegram",
        capability: "message.send",
        workspaceType: "denali",
        exposureCoordinate: resolveIntegrationPolicyExposureCoordinate({
          eventType: "TourPublished",
          provider: "telegram",
        }),
        exposureIntent,
      },
    ],
  } as unknown as IntegrationPolicyEngine;
}

describe("TourPublished telegram delivery message contract", () => {
  const previousEnabled = process.env.INTEGRATION_DELIVERY_ENABLED;
  const previousMode = process.env.FIELD_EXPOSURE_RUNTIME_MODE;

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
  });

  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.INTEGRATION_DELIVERY_ENABLED;
    else process.env.INTEGRATION_DELIVERY_ENABLED = previousEnabled;
    if (previousMode === undefined) delete process.env.FIELD_EXPOSURE_RUNTIME_MODE;
    else process.env.FIELD_EXPOSURE_RUNTIME_MODE = previousMode;
  });

  it("does not poison dispatch with profile defaultTemplateId when intent template is empty", async () => {
    const enqueued: EnqueuedJob[] = [];
    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-tp-1",
        eventType: "TourPublished",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: {
          tenantId: "tenant-a",
          tourId: "tour-1",
          title: "تور جدید",
          deliverySnapshot: {
            title: "تور جدید",
            destinationId: "dest-1",
            startDateTime: "2026-06-30T22:30:00.000Z",
          },
        },
      },
      {
        policyEngine: buildPolicyEngine(tourPublishedIntent()),
        resolvePersistedExposureProfileForContext: async (input) =>
          resolveRegistrySeededExposureProfile(input.context),
        resolveWorkspaceType: async () => "denali",
        resolveDeliveryReferenceDisplayValues: async () => ({
          destinationId: "دماوند",
        }),
        deliveryRepository: {
          async enqueueJob(input: unknown) {
            enqueued.push(input as EnqueuedJob);
            return true;
          },
          async claimPendingBatch() {
            return [];
          },
          async markDone() {},
          async markFailedForRetry() {},
          async markDead() {},
        } as never,
      },
    );

    assert.equal(enqueued.length, 1);
    const payload = enqueued[0]!.payload;
    assert.equal(payload.integrationDeliveryMessageTemplate, undefined);
    assert.notEqual(payload.integrationDeliveryFieldIds, undefined);

    const rendered = await formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourPublished",
      payload,
    });

    assert.match(rendered, /Tour published: تور جدید/);
    assert.match(rendered, /Destination: دماوند|مقصد: دماوند/);
    assert.doesNotMatch(rendered, /00000000-0000-4000/);
    assert.doesNotMatch(rendered, /2026-06-30T22:30:00\.000Z/);
  });
});
