import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  dispatchIntegrationDomainEvent,
  FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV,
  FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV,
  isFieldExposureEngineFailClosedEnabled,
} from "../src/integrations/application/dispatch-integration-domain-event";
import type { IntegrationPolicyEngine } from "../src/integrations/application/integration-policy-engine";
import type { IntegrationDeliveryRepository } from "../src/integrations/infrastructure/prisma-integration-delivery.repository";
import { resolveRegistrySeededExposureProfile } from "../src/exposure/resolve-registry-seeded-exposure-profile";
import { resolvePersistedExposureProfileForContext } from "../src/exposure/resolve-persisted-exposure-profile";
import { metricsRegistry, resetMetricsRegistryForTests } from "../src/observability/metrics";

async function resolveSeededPersistedExposureProfile(
  input: Parameters<typeof resolvePersistedExposureProfileForContext>[0],
) {
  return resolveRegistrySeededExposureProfile(input.context);
}

function dispatchDeps(
  overrides: Parameters<typeof dispatchIntegrationDomainEvent>[1] = {},
): Parameters<typeof dispatchIntegrationDomainEvent>[1] {
  return {
    resolvePersistedExposureProfileForContext: resolveSeededPersistedExposureProfile,
    ...overrides,
  };
}

function emptyDeliveryRepository(
  enqueued: unknown[] = [],
): IntegrationDeliveryRepository {
  return {
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
}

const policyEngine: IntegrationPolicyEngine = {
  evaluate: async () => [
    {
      connectionId: "conn-1",
      tenantId: "tenant-a",
      provider: "telegram",
      capability: "message.send",
      workspaceType: "denali",
      exposureIntent: null,
      exposureCoordinate: {
        surface: "telegram",
        audience: "external_channel",
        trigger: "TourCreated",
      },
    },
  ],
};

const domainEvent = {
  tenantId: "tenant-a",
  domainEventId: "evt-1",
  eventType: "TourCreated",
  aggregateType: "Tour",
  aggregateId: "tour-1",
  payload: { tourId: "tour-1", title: "Alpine Day" },
};

describe("field-exposure dispatch fail-closed (phase 9.10)", () => {
  const previousDelivery = process.env.INTEGRATION_DELIVERY_ENABLED;
  const previousFailClosed = process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV];
  const previousForwardShadow = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
    delete process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV];
    delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    resetMetricsRegistryForTests();
  });

  afterEach(() => {
    if (previousDelivery === undefined) delete process.env.INTEGRATION_DELIVERY_ENABLED;
    else process.env.INTEGRATION_DELIVERY_ENABLED = previousDelivery;
    if (previousFailClosed === undefined) delete process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV];
    else process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV] = previousFailClosed;
    if (previousForwardShadow === undefined) {
      delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    } else {
      process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = previousForwardShadow;
    }
  });

  it("isFieldExposureEngineFailClosedEnabled is false by default", () => {
    assert.equal(isFieldExposureEngineFailClosedEnabled(), false);
    process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV] = "true";
    assert.equal(isFieldExposureEngineFailClosedEnabled(), true);
  });

  it("skips enqueue when fail-closed is enabled and the forward selector throws", async () => {
    process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV] = "true";
    const enqueued: unknown[] = [];

    const count = await dispatchIntegrationDomainEvent(
      domainEvent,
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveForwardEngineDecisionMap: () => {
          throw new Error("selector_failed");
        },
      }),
    );

    assert.equal(count, 0);
    assert.equal(enqueued.length, 0);
    assert.equal(
      metricsRegistry.getMetric("field_exposure_engine_selector_failure_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        surface: "telegram",
      }),
      1,
    );
  });

  it("records selector failure metric but still enqueues when fail-closed is disabled", async () => {
    const enqueued: unknown[] = [];

    const count = await dispatchIntegrationDomainEvent(
      domainEvent,
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveForwardEngineDecisionMap: () => {
          throw new Error("selector_failed");
        },
      }),
    );

    assert.equal(count, 1);
    assert.equal(enqueued.length, 1);
    assert.equal(
      metricsRegistry.getMetric("field_exposure_engine_selector_failure_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        surface: "telegram",
      }),
      1,
    );
  });

  it("still enqueues when fail-closed is enabled but only the shadow engine throws", async () => {
    process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV] = "true";
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";
    const enqueued: unknown[] = [];

    const count = await dispatchIntegrationDomainEvent(
      domainEvent,
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        runFieldExposureDecisionEngineShadow: () => {
          throw new Error("shadow_failed");
        },
      }),
    );

    assert.equal(count, 1);
    assert.equal(enqueued.length, 1);
    assert.equal(
      metricsRegistry.getMetric("field_exposure_engine_selector_failure_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        surface: "telegram",
      }) ?? 0,
      0,
    );
  });
});
