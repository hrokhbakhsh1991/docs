import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  dispatchIntegrationDomainEvent,
  isIntegrationDeliveryDispatcherEnabled,
} from "./dispatch-integration-domain-event";
import type { IntegrationPolicyEngine } from "./integration-policy-engine";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";

describe("dispatch-integration-domain-event", () => {
  const previousEnv = process.env.INTEGRATION_DELIVERY_ENABLED;

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
  });

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.INTEGRATION_DELIVERY_ENABLED;
    } else {
      process.env.INTEGRATION_DELIVERY_ENABLED = previousEnv;
    }
  });

  it("is disabled by default env", () => {
    delete process.env.INTEGRATION_DELIVERY_ENABLED;
    assert.equal(isIntegrationDeliveryDispatcherEnabled(), false);
  });

  it("enqueues jobs from policy engine decisions", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
        },
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "channel.create",
          workspaceType: "denali",
        },
      ],
    };
    const deliveryRepository: IntegrationDeliveryRepository = {
      async enqueueJob(input) {
        enqueued.push(input);
        return true;
      },
      async claimPendingBatch() {
        return [];
      },
      async markDone() {},
      async markFailedForRetry() {},
      async markDead() {},
    };

    const count = await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { tourId: "tour-1", title: "Alpine Day" },
      },
      {
        policyEngine,
        deliveryRepository,
        resolveWorkspaceType: async () => "denali",
      }
    );

    assert.equal(count, 2);
    assert.equal(enqueued.length, 2);
    const first = enqueued[0] as { payload: { integrationConnectionId: string } };
    assert.equal(first.payload.integrationConnectionId, "conn-1");
  });

  it("no-ops when dispatcher feature flag is off", async () => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "false";
    const count = await dispatchIntegrationDomainEvent({
      tenantId: "tenant-a",
      domainEventId: "evt-1",
      eventType: "TourCreated",
      aggregateType: "Tour",
      aggregateId: "tour-1",
      payload: {},
    });
    assert.equal(count, 0);
  });
});
