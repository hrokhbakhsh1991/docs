import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  dispatchIntegrationDomainEvent,
  isIntegrationDeliveryDispatcherEnabled,
  isFieldExposureDecisionEngineShadowEnabled,
  FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV,
} from "./dispatch-integration-domain-event";
import { getDefaultDeliveryFields } from "../platform/build-delivery-field-catalog";
import type {
  IntegrationPolicyDecision,
  IntegrationPolicyEngine,
} from "./integration-policy-engine";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "../../exposure/exposure-intent";
import { resolveRegistrySeededExposureProfile } from "../../exposure/resolve-registry-seeded-exposure-profile";
import { resolvePersistedExposureProfileForContext } from "../../exposure/resolve-persisted-exposure-profile";
import { formatIntegrationDeliveryMessage } from "../platform/format-integration-delivery-message";
import { logger } from "../../observability/logger";
import {
  metricsRegistry,
  recordFieldExposureShadowParityMismatch,
  resetMetricsRegistryForTests,
} from "../../observability/metrics";

function emptyDeliveryRepository(enqueued: unknown[] = []): IntegrationDeliveryRepository {
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

async function resolveSeededPersistedExposureProfile(
  input: Parameters<typeof resolvePersistedExposureProfileForContext>[0]
) {
  return await resolveRegistrySeededExposureProfile(input.context);
}

function dispatchDeps(
  overrides: Parameters<typeof dispatchIntegrationDomainEvent>[1] = {}
): Parameters<typeof dispatchIntegrationDomainEvent>[1] {
  const policyEngine =
    overrides.policyEngine === undefined
      ? undefined
      : ({
          async evaluate(input) {
            const decisions = await overrides.policyEngine!.evaluate(input);
            return decisions.map((decision) => ({
              ...decision,
              exposureCoordinate:
                decision.exposureCoordinate ??
                ({
                  surface: decision.provider,
                  audience: "external_channel",
                  trigger: input.eventType,
                } satisfies IntegrationPolicyDecision["exposureCoordinate"]),
            }));
          },
        } satisfies IntegrationPolicyEngine);

  return {
    resolvePersistedExposureProfileForContext: resolveSeededPersistedExposureProfile,
    ...overrides,
    ...(policyEngine === undefined ? {} : { policyEngine }),
  };
}

function deliverySelectionPayload(payload: Record<string, unknown>) {
  return {
    integrationDeliveryCandidateFieldIds: payload.integrationDeliveryCandidateFieldIds,
    integrationDeliveryFieldIds: payload.integrationDeliveryFieldIds,
    integrationDeliveryFieldValues: payload.integrationDeliveryFieldValues,
    integrationDeliveryMessageTemplate: payload.integrationDeliveryMessageTemplate,
  };
}

function nativeIntent() {
  return {
    id: "native-1",
    profileId: "denali.telegram.TourCreated",
    workspaceType: "denali" as const,
    entityType: "tour",
    surface: "telegram",
    audience: "external_channel",
    trigger: "TourCreated",
    scope: { connectionId: "conn-1" },
    mode: "override_fields" as const,
    selectedFieldIds: ["native.title"],
    templateOverrideId: "Native {{field:native.title}}",
    source: NATIVE_EXPOSURE_INTENT_SOURCE,
    sourceId: "native-1",
    version: "2026-01-01T00:00:00.000Z",
  };
}

describe("dispatch-integration-domain-event", () => {
  const previousEnv = process.env.INTEGRATION_DELIVERY_ENABLED;
  const previousRuntimeMode = process.env.FIELD_EXPOSURE_RUNTIME_MODE;
  const previousShadowDiagnostics = process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS;
  const previousForwardShadow = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
    delete process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS;
    delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    resetMetricsRegistryForTests();
  });

  afterEach(() => {
    if (previousEnv === undefined) delete process.env.INTEGRATION_DELIVERY_ENABLED;
    else process.env.INTEGRATION_DELIVERY_ENABLED = previousEnv;
    if (previousRuntimeMode === undefined) delete process.env.FIELD_EXPOSURE_RUNTIME_MODE;
    else process.env.FIELD_EXPOSURE_RUNTIME_MODE = previousRuntimeMode;
    if (previousShadowDiagnostics === undefined) {
      delete process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS;
    } else {
      process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS = previousShadowDiagnostics;
    }
    if (previousForwardShadow === undefined) {
      delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    } else {
      process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = previousForwardShadow;
    }
  });

  it("keeps forward shadow engine disabled by default", async () => {
    delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    assert.equal(isFieldExposureDecisionEngineShadowEnabled(), false);
  });

  it("keeps integration delivery payload unchanged when forward shadow is enabled", async () => {
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "starter",
          exposureIntent: null,
        },
      ],
    };
    const row = {
      tenantId: "tenant-a",
      domainEventId: "evt-1",
      eventType: "TourCreated",
      aggregateType: "Tour",
      aggregateId: "tour-1",
      payload: { status: "published", title: "Alpine Day" },
    };

    const enqueuedShadowOff: unknown[] = [];
    await dispatchIntegrationDomainEvent(
      row,
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueuedShadowOff),
        resolveWorkspaceType: async () => "starter",
      })
    );

    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";
    const enqueuedShadowOn: unknown[] = [];
    await dispatchIntegrationDomainEvent(
      row,
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueuedShadowOn),
        resolveWorkspaceType: async () => "starter",
      })
    );

    const shadowOffPayload = (enqueuedShadowOff[0] as { payload: Record<string, unknown> }).payload;
    const shadowOnPayload = (enqueuedShadowOn[0] as { payload: Record<string, unknown> }).payload;

    assert.deepEqual(
      deliverySelectionPayload(shadowOnPayload),
      deliverySelectionPayload(shadowOffPayload)
    );
  });

  it("emits one parity summary from dispatch when forward shadow is enabled", async () => {
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "starter",
          exposureIntent: null,
        },
      ],
    };
    const infoCalls: Record<string, unknown>[] = [];
    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      infoCalls.push(obj);
    };

    try {
      await dispatchIntegrationDomainEvent(
        {
          tenantId: "tenant-a",
          domainEventId: "evt-1",
          eventType: "TourCreated",
          aggregateType: "Tour",
          aggregateId: "tour-1",
          payload: { status: "published", title: "Alpine Day" },
        },
        dispatchDeps({
          policyEngine,
          deliveryRepository: emptyDeliveryRepository(),
          resolveWorkspaceType: async () => "starter",
        })
      );

      const summaries = infoCalls.filter(
        (call) => call.event === "field_exposure.shadow_parity_summary"
      );
      assert.equal(summaries.length, 1);
      const mismatchCount = summaries[0]?.mismatchCount as number;
      assert.equal(typeof mismatchCount, "number");
      assert.equal(typeof summaries[0]?.fieldCount, "number");
      assert.equal(summaries[0]?.surface, "telegram");
      assert.equal(summaries[0]?.matches, mismatchCount === 0);

      assert.equal(
        metricsRegistry.getMetric("field_exposure_engine_shadow_mismatch_total", {
          tenant_id: "tenant-a",
          event_type: "TourCreated",
          surface: "telegram",
        }) ?? 0,
        mismatchCount > 0 ? mismatchCount : 0
      );
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("still enqueues delivery jobs when forward shadow engine throws", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";

    const count = await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { tourId: "tour-1", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        runFieldExposureDecisionEngineShadow: () => {
          throw new Error("shadow_failed");
        },
      })
    );

    assert.equal(count, 1);
    assert.equal(enqueued.length, 1);
  });

  it("does not run temporary forward shadow diagnostics in cutover mode", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";
    let shadowCalls = 0;
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(),
        resolveWorkspaceType: async () => "denali",
        runFieldExposureDecisionEngineShadow: () => {
          shadowCalls += 1;
        },
      })
    );

    assert.equal(shadowCalls, 0);
  });

  it("is disabled by default env", async () => {
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
          exposureIntent: null,
        },
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "channel.create",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
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
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    assert.equal(count, 2);
    const first = enqueued[0] as {
      payload: {
        integrationConnectionId: string;
        fieldExposureRuntime: { mode: string; selectionSource: string };
      };
    };
    assert.equal(first.payload.integrationConnectionId, "conn-1");
    assert.equal(first.payload.fieldExposureRuntime.mode, "shadow");
    assert.equal(first.payload.fieldExposureRuntime.selectionSource, "exposure_profile_defaults");
  });

  it("merges TourPublished deliverySnapshot into enqueued delivery payload", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    const count = await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "TourPublished:tour-1:2",
        eventType: "TourPublished",
        aggregateType: "tour",
        aggregateId: "tour-1",
        payload: {
          schemaVersion: 1,
          tenantId: "tenant-a",
          tourId: "tour-1",
          rowVersion: 2,
          publishStatus: "active",
          title: "Alpine Day",
          occurredAt: "2026-06-29T12:00:00.000Z",
          deliverySnapshot: {
            title: "Alpine Day",
            publishStatus: "active",
          },
        },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    assert.equal(count, 1);
    const job = enqueued[0] as {
      eventType: string;
      domainEventId: string;
      payload: Record<string, unknown>;
    };
    assert.equal(job.eventType, "TourPublished");
    assert.equal(job.domainEventId, "TourPublished:tour-1:2");
    assert.equal(job.payload.title, "Alpine Day");
    assert.equal(job.payload.publishStatus, "active");
    assert.equal(job.payload.tourId, "tour-1");
  });

  it("no-ops duplicate TourPublished enqueue when repository reports idempotent skip", async () => {
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };
    const row = {
      tenantId: "tenant-a",
      domainEventId: "TourPublished:tour-1:2",
      eventType: "TourPublished",
      aggregateType: "tour",
      aggregateId: "tour-1",
      payload: {
        tourId: "tour-1",
        deliverySnapshot: { title: "Alpine Day", publishStatus: "active" },
      },
    };
    let insertCount = 0;
    const deliveryRepository: IntegrationDeliveryRepository = {
      async enqueueJob() {
        insertCount += 1;
        return insertCount === 1;
      },
      async claimPendingBatch() {
        return [];
      },
      async markDone() {},
      async markFailedForRetry() {},
      async markDead() {},
    };

    const first = await dispatchIntegrationDomainEvent(
      row,
      dispatchDeps({
        policyEngine,
        deliveryRepository,
        resolveWorkspaceType: async () => "denali",
      })
    );
    const second = await dispatchIntegrationDomainEvent(
      row,
      dispatchDeps({
        policyEngine,
        deliveryRepository,
        resolveWorkspaceType: async () => "denali",
      })
    );

    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.equal(insertCount, 2);
  });

  it("enqueues provider-agnostic delivery field eligibility metadata", async () => {
    process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS = "true";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "starter",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { status: "published", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "starter",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryCandidateFieldIds: readonly string[];
        integrationDeliveryFieldIds: readonly string[];
        fieldExposureDecision: {
          candidateFieldIds: readonly string[];
        };
        fieldExposureShadow: {
          candidateFieldIds: readonly string[];
          exposedFieldIds: readonly string[];
          context: Record<string, unknown>;
          renderedParity: { matches: boolean };
          deliveryParity: { matches: boolean };
          parity: { matches: boolean };
          renderedMessage: string;
        };
        fieldExposureRuntime: {
          mode: string;
          source: string;
          selectionSource: string;
          nativeIntentMissing: boolean;
        };
      };
    };
    assert.deepEqual(
      first.payload.integrationDeliveryCandidateFieldIds,
      first.payload.fieldExposureDecision.candidateFieldIds
    );
    assert.equal(first.payload.fieldExposureShadow.parity.matches, true);
    assert.deepEqual(first.payload.fieldExposureRuntime, {
      mode: "shadow",
      source: "exposure_resolver",
      selectionSource: "exposure_profile_defaults",
      nativeIntentMissing: true,
    });
    assert.equal(
      first.payload.fieldExposureShadow.renderedMessage,
      await formatIntegrationDeliveryMessage({
        workspaceType: "starter",
        eventType: "TourCreated",
        payload: first.payload as Record<string, unknown>,
      })
    );
    assert.equal(first.payload.fieldExposureShadow.parity.matches, true);
  });

  it("uses engine catalog candidates while preserving native template override", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: {
            ...nativeIntent(),
            selectedFieldIds: ["basics.featured"],
            templateOverrideId: "Custom {{field:basics.title}}",
          },
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { status: "published", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryCandidateFieldIds: readonly string[];
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues: Readonly<Record<string, string>>;
        integrationDeliveryMessageTemplate: string;
      };
    };
    assert.ok(first.payload.integrationDeliveryCandidateFieldIds.includes("title"));
    assert.notDeepEqual(first.payload.integrationDeliveryCandidateFieldIds, ["basics.featured"]);
    assert.deepEqual(first.payload.integrationDeliveryFieldIds, []);
    assert.equal(first.payload.integrationDeliveryMessageTemplate, "Custom {{field:basics.title}}");
  });

  it("uses registry deliverable defaults when exposure intent is absent", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { tourId: "tour-1", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues?: Readonly<Record<string, string>>;
      };
    };
    assert.deepEqual(
      first.payload.integrationDeliveryFieldIds,
      await getDefaultDeliveryFields("denali")
    );
    assert.deepEqual(first.payload.integrationDeliveryFieldValues, { title: "Alpine Day" });
  });

  it("uses native exposure intent metadata without invoking legacy delivery eligibility", async () => {
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: nativeIntent(),
        },
      ],
    };
    const enqueued: unknown[] = [];

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryMessageTemplate: string;
        fieldExposureRuntime: {
          selectionSource: string;
          nativeIntentMissing: boolean;
        };
      };
    };
    assert.equal(first.payload.integrationDeliveryMessageTemplate, "Native {{field:native.title}}");
    assert.equal(first.payload.fieldExposureRuntime.selectionSource, "native_exposure_intent");
    assert.equal(first.payload.fieldExposureRuntime.nativeIntentMissing, false);
  });

  it("falls back to profile defaults in cutover mode when no native row exists", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        fieldExposureRuntime: {
          mode: string;
          selectionSource: string;
          nativeIntentMissing: boolean;
        };
      };
    };
    assert.equal(first.payload.fieldExposureRuntime.mode, "cutover");
    assert.equal(first.payload.fieldExposureRuntime.selectionSource, "exposure_profile_defaults");
    assert.equal(first.payload.fieldExposureRuntime.nativeIntentMissing, true);
  });

  it("uses engine-selected field selector in shadow mode", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { legacyTitle: "Legacy", engineTitle: "Engine" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveExposureDecision: () => ({
          decision: {
            profileId: "denali.telegram.TourCreated",
            profileVersion: "v1",
            resolverVersion: "8.0.0",
            selectionSource: "exposure_profile_defaults",
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            engineSelectedFieldIds: ["engine.title"],
          },
          deliveryPolicy: {
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            definitions: [
              {
                id: "legacy.title",
                workspaceType: "denali",
                canonicalPath: "legacyTitle",
                kind: "text",
                version: 1,
              },
              {
                id: "engine.title",
                workspaceType: "denali",
                canonicalPath: "engineTitle",
                kind: "text",
                version: 1,
              },
            ],
          },
          messageTemplate: null,
          definitions: [],
        }),
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues: Readonly<Record<string, string>>;
        fieldExposureRuntime: { engineSelectorMissing?: true };
      };
    };
    assert.deepEqual(first.payload.integrationDeliveryFieldIds, ["engine.title"]);
    assert.deepEqual(first.payload.integrationDeliveryFieldValues, { "engine.title": "Engine" });
  });

  it("records engine-selected ids on audit metadata in shadow and uses them for delivery", async () => {
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { status: "published", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryFieldIds: readonly string[];
        fieldExposureDecision: {
          eligibleFieldIds: readonly string[];
          engineSelectedFieldIds?: readonly string[];
        };
      };
    };

    assert.ok(Array.isArray(first.payload.fieldExposureDecision.engineSelectedFieldIds));
    assert.deepEqual(
      first.payload.integrationDeliveryFieldIds,
      first.payload.fieldExposureDecision.engineSelectedFieldIds
    );
  });

  it("emits selector parity when engine-selected ids are available", async () => {
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };
    const infoCalls: Record<string, unknown>[] = [];
    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      infoCalls.push(obj);
    };

    try {
      await dispatchIntegrationDomainEvent(
        {
          tenantId: "tenant-a",
          domainEventId: "evt-1",
          eventType: "TourCreated",
          aggregateType: "Tour",
          aggregateId: "tour-1",
          payload: { legacyTitle: "Legacy", engineTitle: "Engine" },
        },
        dispatchDeps({
          policyEngine,
          deliveryRepository: emptyDeliveryRepository(),
          resolveWorkspaceType: async () => "denali",
          resolveExposureDecision: () => ({
            decision: {
              profileId: "denali.telegram.TourCreated",
              profileVersion: "v1",
              resolverVersion: "8.0.0",
              selectionSource: "exposure_profile_defaults",
              candidateFieldIds: ["legacy.title", "engine.title", "shared.title"],
              eligibleFieldIds: ["legacy.title", "shared.title"],
              engineSelectedFieldIds: ["engine.title", "shared.title"],
            },
            deliveryPolicy: {
              candidateFieldIds: ["legacy.title", "engine.title", "shared.title"],
              eligibleFieldIds: ["legacy.title", "shared.title"],
              definitions: [],
            },
            messageTemplate: null,
            definitions: [],
          }),
        })
      );

      const parity = infoCalls.find((call) => call.event === "field_exposure.selector_parity");
      assert.ok(parity);
      assert.equal(parity.matches, false);
      assert.equal(parity.mismatchCount, 2);
      assert.deepEqual(parity.legacyOnlyFieldIds, ["legacy.title"]);
      assert.deepEqual(parity.engineOnlyFieldIds, ["engine.title"]);
      assert.equal("acceptedCutoverScope" in parity, false);
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("uses engine-selected field ids for delivery payload and enrichment in cutover mode", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { legacyTitle: "Legacy", engineTitle: "Engine" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveExposureDecision: () => ({
          decision: {
            profileId: "denali.telegram.TourCreated",
            profileVersion: "v1",
            resolverVersion: "8.0.0",
            selectionSource: "exposure_profile_defaults",
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            engineSelectedFieldIds: ["engine.title"],
          },
          deliveryPolicy: {
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            definitions: [
              {
                id: "legacy.title",
                workspaceType: "denali",
                canonicalPath: "legacyTitle",
                kind: "text",
                version: 1,
              },
              {
                id: "engine.title",
                workspaceType: "denali",
                canonicalPath: "engineTitle",
                kind: "text",
                version: 1,
              },
            ],
          },
          messageTemplate: null,
          definitions: [],
        }),
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryCandidateFieldIds: readonly string[];
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues: Readonly<Record<string, string>>;
        fieldExposureRuntime: { engineSelectorMissing?: true };
      };
    };
    assert.deepEqual(first.payload.integrationDeliveryCandidateFieldIds, [
      "legacy.title",
      "engine.title",
    ]);
    assert.deepEqual(first.payload.integrationDeliveryFieldIds, ["engine.title"]);
    assert.deepEqual(first.payload.integrationDeliveryFieldValues, { "engine.title": "Engine" });
  });

  it("uses engine-selected ids outside the historical accepted cutover scope", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "PaymentCompleted",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { legacyTitle: "Legacy", engineTitle: "Engine" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveExposureDecision: () => ({
          decision: {
            profileId: "denali.telegram.PaymentCompleted",
            profileVersion: "v1",
            resolverVersion: "8.0.0",
            selectionSource: "exposure_profile_defaults",
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            engineSelectedFieldIds: ["engine.title"],
          },
          deliveryPolicy: {
            candidateFieldIds: ["legacy.title", "engine.title"],
            eligibleFieldIds: ["legacy.title"],
            definitions: [
              {
                id: "legacy.title",
                workspaceType: "denali",
                canonicalPath: "legacyTitle",
                kind: "text",
                version: 1,
              },
              {
                id: "engine.title",
                workspaceType: "denali",
                canonicalPath: "engineTitle",
                kind: "text",
                version: 1,
              },
            ],
          },
          messageTemplate: null,
          definitions: [],
        }),
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues: Readonly<Record<string, string>>;
        fieldExposureRuntime: { engineSelectorMissing?: true };
      };
    };
    assert.deepEqual(first.payload.integrationDeliveryFieldIds, ["engine.title"]);
    assert.deepEqual(first.payload.integrationDeliveryFieldValues, { "engine.title": "Engine" });
    assert.equal(first.payload.fieldExposureRuntime.engineSelectorMissing, undefined);
  });

  it("emits an empty engine selection when cutover lacks engine-selected ids", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { legacyTitle: "Legacy" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
        resolveExposureDecision: () => ({
          decision: {
            profileId: "denali.telegram.TourCreated",
            profileVersion: "v1",
            resolverVersion: "8.0.0",
            selectionSource: "exposure_profile_defaults",
            candidateFieldIds: ["legacy.title"],
            eligibleFieldIds: ["legacy.title"],
          },
          deliveryPolicy: {
            candidateFieldIds: ["legacy.title"],
            eligibleFieldIds: ["legacy.title"],
            definitions: [
              {
                id: "legacy.title",
                workspaceType: "denali",
                canonicalPath: "legacyTitle",
                kind: "text",
                version: 1,
              },
            ],
          },
          messageTemplate: null,
          definitions: [],
        }),
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryFieldIds: readonly string[];
        integrationDeliveryFieldValues: Readonly<Record<string, string>>;
        fieldExposureRuntime: { engineSelectorMissing?: true };
      };
    };
    assert.deepEqual(first.payload.integrationDeliveryFieldIds, []);
    assert.deepEqual(first.payload.integrationDeliveryFieldValues, {});
    assert.equal(first.payload.fieldExposureRuntime.engineSelectorMissing, true);
  });

  it("does not attach legacy mirror shadow metadata in cutover mode", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    process.env.FIELD_EXPOSURE_SHADOW_DIAGNOSTICS = "true";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { status: "published", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as { payload: { fieldExposureShadow?: unknown } };
    assert.equal(first.payload.fieldExposureShadow, undefined);
  });

  it("uses engine-projected candidate ids on cutover compatibility payload", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const enqueued: unknown[] = [];
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { status: "published", title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(enqueued),
        resolveWorkspaceType: async () => "denali",
      })
    );

    const first = enqueued[0] as {
      payload: {
        integrationDeliveryCandidateFieldIds: readonly string[];
        integrationDeliveryFieldIds: readonly string[];
        fieldExposureDecision: {
          candidateFieldIds: readonly string[];
          engineSelectedFieldIds?: readonly string[];
        };
      };
    };

    assert.deepEqual(
      first.payload.integrationDeliveryCandidateFieldIds,
      first.payload.fieldExposureDecision.candidateFieldIds
    );
    const defaultDeliveryFields = await getDefaultDeliveryFields("denali");
    assert.ok(
      first.payload.integrationDeliveryCandidateFieldIds.length >= defaultDeliveryFields.length
    );
    assert.deepEqual(
      first.payload.integrationDeliveryFieldIds,
      first.payload.fieldExposureDecision.engineSelectedFieldIds
    );
  });

  it("records runtime selection observability for shadow profile-default jobs", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "shadow";
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: null,
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(),
        resolveWorkspaceType: async () => "denali",
      })
    );

    assert.equal(
      metricsRegistry.getMetric("field_exposure_runtime_selection_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        provider: "telegram",
        runtime_mode: "shadow",
        selection_source: "exposure_profile_defaults",
        native_intent_missing: "true",
      }),
      1
    );
  });

  it("records runtime and compatibility cutover selection observability for cutover jobs", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const policyEngine: IntegrationPolicyEngine = {
      evaluate: async () => [
        {
          connectionId: "conn-1",
          tenantId: "tenant-a",
          provider: "telegram",
          capability: "message.send",
          workspaceType: "denali",
          exposureIntent: nativeIntent(),
        },
      ],
    };

    await dispatchIntegrationDomainEvent(
      {
        tenantId: "tenant-a",
        domainEventId: "evt-1",
        eventType: "TourCreated",
        aggregateType: "Tour",
        aggregateId: "tour-1",
        payload: { title: "Alpine Day" },
      },
      dispatchDeps({
        policyEngine,
        deliveryRepository: emptyDeliveryRepository(),
        resolveWorkspaceType: async () => "denali",
      })
    );

    assert.equal(
      metricsRegistry.getMetric("field_exposure_runtime_selection_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        provider: "telegram",
        runtime_mode: "cutover",
        selection_source: "native_exposure_intent",
        native_intent_missing: "false",
      }),
      1
    );
    assert.equal(
      metricsRegistry.getMetric("field_exposure_cutover_selection_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        provider: "telegram",
        selection_source: "native_exposure_intent",
        native_intent_missing: "false",
      }),
      1
    );
  });

  it("wires recordFieldExposureShadowParityMismatch for shadow parity audit", async () => {
    const { resolveShadowDeliveryFieldParity } =
      await import("../../exposure/shadow-delivery-field-parity");
    const parity = resolveShadowDeliveryFieldParity({
      shadow: {
        candidateFieldIds: ["title"],
        exposedFieldIds: ["title"],
        fieldValues: { title: "A" },
        templateOverrideId: "One",
      },
      authoritative: {
        candidateFieldIds: ["title"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "B" },
        messageTemplate: "One",
      },
    });
    assert.equal(parity.matches, false);
    recordFieldExposureShadowParityMismatch({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      provider: "telegram",
      mismatchCount: parity.mismatches.length,
    });
    assert.equal(
      metricsRegistry.getMetric("field_exposure_shadow_parity_mismatch_total", {
        tenant_id: "tenant-a",
        event_type: "TourCreated",
        provider: "telegram",
        mismatch_count: "1",
      }),
      1
    );
  });

  it("keeps Telegram formatter output unchanged for eligible field placeholders", async () => {
    const message = await formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourCreated",
      payload: {
        title: "Alpine Day",
        integrationDeliveryFieldIds: ["title"],
        integrationDeliveryFieldValues: { title: "Alpine Day" },
      },
    });
    assert.match(message, /Alpine Day/);
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
