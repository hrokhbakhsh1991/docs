import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  fieldExposureRuntimeMetadata,
  resolveFieldExposureRuntimeMode,
} from "../src/exposure/exposure-runtime-mode";
import { dispatchIntegrationDomainEvent } from "../src/integrations/application/dispatch-integration-domain-event";
import {
  resolveIntegrationPolicyExposureCoordinate,
  type IntegrationPolicyEngine,
} from "../src/integrations/application/integration-policy-engine";
import { resolveRegistrySeededExposureProfile } from "../src/exposure/resolve-registry-seeded-exposure-profile";
import { resolvePersistedExposureProfileForContext } from "../src/exposure/resolve-persisted-exposure-profile";
import { formatIntegrationDeliveryMessage } from "../src/integrations/platform/format-integration-delivery-message";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-6-guard.mjs");
const INTEGRATIONS_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/integrations/http/integrations.service.ts",
);
const FORMATTER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/platform/format-integration-delivery-message.ts",
);
const WORKER_SOURCE = join(
  REPO_ROOT,
  "apps/api/src/integrations/worker/process-integration-delivery-once.ts",
);
const METRICS_SOURCE = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const PROVIDERS_DIR = join(REPO_ROOT, "apps/api/src/integrations/providers");

function listProviderSources(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(PROVIDERS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const nested of readdirSync(join(PROVIDERS_DIR, entry.name), {
      withFileTypes: true,
    })) {
      if (nested.isFile() && nested.name.endsWith(".ts") && !nested.name.endsWith(".spec.ts")) {
        files.push(join(PROVIDERS_DIR, entry.name, nested.name));
      }
    }
  }
  return files;
}

const NATIVE_EXPOSURE_INTENT_SOURCE = "native_exposure_intent" as const;

type EnqueuedJob = {
  payload: {
    integrationDeliveryMessageTemplate?: string;
    fieldExposureRuntime: {
      mode: string;
      source: string;
      selectionSource: string;
      nativeIntentMissing: boolean;
    };
  };
};

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

function buildPolicyEngine(
  exposureIntent: ReturnType<typeof nativeIntent> | null,
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
          eventType: "TourCreated",
          provider: "telegram",
        }),
        exposureIntent,
      },
    ],
  } as unknown as IntegrationPolicyEngine;
}

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

async function dispatchOnce(
  exposureIntent: ReturnType<typeof nativeIntent> | null,
): Promise<EnqueuedJob> {
  const enqueued: EnqueuedJob[] = [];
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
      policyEngine: buildPolicyEngine(exposureIntent),
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
      resolveWorkspaceType: async () => "denali",
    }),
  );
  assert.equal(enqueued.length, 1);
  return enqueued[0]!;
}

describe("field exposure phase 6 controlled cutover contract", () => {
  const previousMode = process.env.FIELD_EXPOSURE_RUNTIME_MODE;
  const previousEnabled = process.env.INTEGRATION_DELIVERY_ENABLED;

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
  });

  afterEach(() => {
    if (previousMode === undefined) delete process.env.FIELD_EXPOSURE_RUNTIME_MODE;
    else process.env.FIELD_EXPOSURE_RUNTIME_MODE = previousMode;
    if (previousEnabled === undefined) delete process.env.INTEGRATION_DELIVERY_ENABLED;
    else process.env.INTEGRATION_DELIVERY_ENABLED = previousEnabled;
  });

  it("architecture doc marks Phase 6 complete with cutover closure section", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /Phase 6 complete/i);
    assert.match(text, /## Phase 6 — Dual-Write \+ Controlled Cutover/);
    assert.match(text, /guard:field-exposure-phase-6/);
    assert.match(text, /selectionSource/);
    assert.match(text, /nativeIntentMissing/);
  });

  it("runtime mode resolver defaults to shadow", () => {
    assert.equal(resolveFieldExposureRuntimeMode(undefined), "shadow");
    assert.equal(resolveFieldExposureRuntimeMode("cutover"), "cutover");
  });

  it("metadata defaults to exposure profile defaults", () => {
    assert.deepEqual(fieldExposureRuntimeMetadata("shadow"), {
      mode: "shadow",
      source: "exposure_resolver",
      selectionSource: "exposure_profile_defaults",
      nativeIntentMissing: false,
    });
  });

  it("shadow mode uses profile defaults when no native intent exists", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "shadow";
    const job = await dispatchOnce(null);
    assert.equal(job.payload.fieldExposureRuntime.mode, "shadow");
    assert.equal(job.payload.fieldExposureRuntime.selectionSource, "exposure_profile_defaults");
    assert.equal(job.payload.fieldExposureRuntime.nativeIntentMissing, true);
    assert.equal(job.payload.integrationDeliveryMessageTemplate, undefined);
    const rendered = formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourCreated",
      payload: job.payload as Record<string, unknown>,
    });
    assert.match(rendered, /TourCreated: Alpine Day/);
    assert.match(rendered, /Title: Alpine Day/);
  });

  it("cutover mode routes native intent when a native row exists", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const job = await dispatchOnce(nativeIntent());
    assert.equal(job.payload.fieldExposureRuntime.mode, "cutover");
    assert.equal(job.payload.fieldExposureRuntime.selectionSource, "native_exposure_intent");
    assert.equal(job.payload.fieldExposureRuntime.nativeIntentMissing, false);
    assert.equal(
      job.payload.integrationDeliveryMessageTemplate,
      "Native {{field:native.title}}",
    );
  });

  it("cutover mode falls back to profile defaults and records missing native row", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "cutover";
    const job = await dispatchOnce(null);
    assert.equal(job.payload.fieldExposureRuntime.mode, "cutover");
    assert.equal(job.payload.fieldExposureRuntime.selectionSource, "exposure_profile_defaults");
    assert.equal(job.payload.fieldExposureRuntime.nativeIntentMissing, true);
    assert.equal(job.payload.integrationDeliveryMessageTemplate, undefined);
    const rendered = formatIntegrationDeliveryMessage({
      workspaceType: "denali",
      eventType: "TourCreated",
      payload: job.payload as Record<string, unknown>,
    });
    assert.match(rendered, /TourCreated: Alpine Day/);
    assert.match(rendered, /Title: Alpine Day/);
  });

  it("records fieldExposureRuntime even when delivery policy resolves to null", async () => {
    process.env.FIELD_EXPOSURE_RUNTIME_MODE = "shadow";
    const enqueued: EnqueuedJob[] = [];
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
        policyEngine: buildPolicyEngine(null),
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
        resolveWorkspaceType: async () => "denali",
      }),
    );
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0]!.payload.fieldExposureRuntime.mode, "shadow");
    assert.equal(
      enqueued[0]!.payload.fieldExposureRuntime.selectionSource,
      "exposure_profile_defaults",
    );
  });

  it("admin save path persists native exposure intents", () => {
    const service = readFileSync(INTEGRATIONS_SERVICE, "utf8");
    assert.match(service, /patchConnectionExposureIntent/);
    assert.doesNotMatch(service, /mapIntegrationDeliveryIntentWriteToExposureIntent/);
  });

  it("formatter, worker, and providers ignore fieldExposureRuntime metadata", () => {
    const formatter = readFileSync(FORMATTER_SOURCE, "utf8");
    assert.doesNotMatch(formatter, /fieldExposureRuntime/);

    const worker = readFileSync(WORKER_SOURCE, "utf8");
    assert.doesNotMatch(worker, /fieldExposureRuntime/);
    assert.match(worker, /formatIntegrationDeliveryMessage/);

    for (const providerPath of listProviderSources()) {
      assert.doesNotMatch(readFileSync(providerPath, "utf8"), /fieldExposureRuntime/);
    }
  });

  it("cutover selection observability metric is defined", () => {
    const metrics = readFileSync(METRICS_SOURCE, "utf8");
    assert.match(metrics, /field_exposure_cutover_selection_total/);
    assert.match(metrics, /exposure_profile_defaults/);
  });

  it("phase 6 guard passes on repository closure state", () => {
    assert.equal(existsSync(GUARD_SCRIPT), true);
    const result = spawnSync("node", [GUARD_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || "guard failed");
  });
});
