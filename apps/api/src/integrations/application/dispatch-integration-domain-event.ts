import { resolveFieldExposureDecision } from "@app-tour/platform-core";
import { resolveWorkspaceTypeForTenant } from "../../tenant/resolve-workspace-type";
import type { WorkspaceOutboxPublishedRow } from "../../workspace/workspace-outbox-row-context";
import { createIntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import {
  createIntegrationPolicyEngine,
  type IntegrationPolicyEngine,
} from "./integration-policy-engine";
import { enqueueIntegrationDeliveryJob } from "./enqueue-integration-delivery-job";
import type { ResolvedDeliveryFieldPolicy } from "./delivery-field-definitions";
import {
  enrichCanonicalDeliveryPayload,
  type CanonicalDeliveryPayload,
} from "./enrich-canonical-delivery-payload";
import { resolveDeliveryReferenceDisplayValues } from "./resolve-delivery-reference-display-values";
import type { ExposureIntent, ExposureFieldDecorations } from "../../exposure/exposure-intent";
import type { ExposureProfile } from "../../exposure/exposure-profile";
import {
  fieldExposureRuntimeMetadata,
  resolveFieldExposureRuntimeMode,
  type FieldExposureRuntimeMetadata,
} from "../../exposure/exposure-runtime-mode";
import { resolveFieldExposureShadowDiagnostics } from "../../exposure/field-exposure-shadow-diagnostics";
import type { FieldExposureDecision } from "../../exposure/resolve-exposure-decision";
import { resolveExposureDecision } from "../../exposure/resolve-exposure-decision";
import { resolveDeliveryExposureProfileContext } from "../../exposure/resolve-registry-seeded-exposure-profile";
import { resolvePersistedExposureProfileForContext } from "../../exposure/resolve-persisted-exposure-profile";
import {
  recordFieldExposureCutoverSelection,
  recordFieldExposureDecisionAudited,
  recordFieldExposureEngineShadowMismatch,
  recordFieldExposureEngineSelectorFailure,
  recordFieldExposureRuntimeSelection,
  recordFieldExposureShadowParityMismatch,
} from "../../observability/metrics";
import { logger } from "../../observability/logger";
import { compareShadowVsLegacy } from "../../exposure/compare-shadow-vs-legacy";
import { classifyShadowDrift } from "../../exposure/classify-shadow-drift";
import { inferExposurePolicyHypothesis } from "../../exposure/infer-exposure-policy-hypothesis";
import { resolveExposureSelectorParity } from "../../exposure/resolve-exposure-selector-parity";
import { resolveActiveDeliveryFieldIds } from "../../exposure/resolve-active-delivery-field-ids";
import {
  extractObservedExposureModel,
  type ObservedFieldArtifact,
} from "../../exposure/extract-observed-exposure-model";
import { resolveWorkspacePluginForType } from "../../workspace/resolve-workspace-plugin";
import {
  buildFieldExposureEngineDecisionInput,
  buildFieldExposureEngineDecisionMap,
  buildFieldExposureEngineInputSnapshot,
} from "../../exposure/build-field-exposure-engine-input";
import { adjustShadowParityForIntentionalMismatches } from "../../exposure/shadow-parity-intentional-mismatch";
import { resolveFieldExposureRuntimeTruthSource } from "../../exposure/resolve-runtime-truth-source";
import { resolveIntegrationDispatchPayload } from "./resolve-integration-dispatch-payload";

export const FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV =
  "FIELD_EXPOSURE_DECISION_ENGINE_SHADOW" as const;

export const FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV = "FIELD_EXPOSURE_ENGINE_FAIL_CLOSED" as const;

export function isFieldExposureEngineFailClosedEnabled(
  value: string | null | undefined = process.env[FIELD_EXPOSURE_ENGINE_FAIL_CLOSED_ENV]
): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function isFieldExposureDecisionEngineShadowEnabled(
  value: string | null | undefined = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV]
): boolean {
  return value?.trim().toLowerCase() === "true";
}

export type RunForwardFieldExposureDecisionEngineShadowInput = {
  readonly tenantId: string;
  readonly eventType: string;
  readonly workspaceType: string | null;
  readonly surface: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly legacyEligibleFieldIds: readonly string[];
  readonly legacyCandidateFieldIds: readonly string[];
  readonly exposureIntent?: ExposureIntent | null;
  readonly exposureProfile?: Pick<ExposureProfile, "id" | "defaultFieldIds"> | null;
};

async function resolveForwardEngineDecisionMap(input: {
  readonly tenantId: string;
  readonly eventType: string;
  readonly workspaceType: string;
  readonly surface: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly exposureIntent?: ExposureIntent | null;
  readonly exposureProfile?: Pick<ExposureProfile, "id" | "defaultFieldIds"> | null;
}): Promise<ReadonlyMap<string, ReturnType<typeof resolveFieldExposureDecision>>> {
  return buildFieldExposureEngineDecisionMap(input);
}

export async function runForwardFieldExposureDecisionEngineShadow(
  input: RunForwardFieldExposureDecisionEngineShadowInput
): Promise<void> {
  if (!isFieldExposureDecisionEngineShadowEnabled()) {
    return;
  }
  if (input.workspaceType === null || input.workspaceType.trim().length === 0) {
    return;
  }
  const workspaceType = input.workspaceType;

  try {
    const plugin = await resolveWorkspacePluginForType(workspaceType);
    const snapshot = await buildFieldExposureEngineInputSnapshot({
      workspaceType,
      eventType: input.eventType,
      ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
      payload: input.payload,
    });
    const trigger = snapshot.trigger;
    const normalizedTriggerName = trigger.kind === "event" ? trigger.name : trigger.kind;
    const registryCatalog = snapshot.registryCatalog;
    const registryById = new Map(registryCatalog.map((field) => [field.id, field]));
    const fieldPolicySnapshot = {
      rules: (plugin.fieldPolicy?.rules ?? []).map((rule) => ({
        id: rule.id,
        fieldId: rule.fieldId,
        surface: rule.surface,
        state: rule.state,
        enabled: rule.enabled,
      })),
    };
    const eligibleSet = new Set(input.legacyEligibleFieldIds);
    const candidateSet = new Set(input.legacyCandidateFieldIds);
    const shadowDecisionMap = new Map<string, ReturnType<typeof resolveFieldExposureDecision>>();

    for (const field of registryCatalog) {
      const decision = resolveFieldExposureDecision(
        buildFieldExposureEngineDecisionInput({
          tenantId: input.tenantId,
          workspaceType,
          surface: input.surface,
          ...(input.audience === undefined ? {} : { audience: input.audience }),
          fieldId: field.id,
          snapshot,
          exposureIntent: input.exposureIntent,
          exposureProfile: input.exposureProfile,
        })
      );

      shadowDecisionMap.set(field.id, {
        ...decision,
        legacyComparison: {
          isPresentInEligibleFields: eligibleSet.has(field.id),
          isPresentInCandidateFields: candidateSet.has(field.id),
        },
      });
    }

    const parityReport = adjustShadowParityForIntentionalMismatches({
      workspaceType,
      eventType: input.eventType,
      surface: input.surface,
      report: compareShadowVsLegacy({
        legacyEligibleFieldIds: input.legacyEligibleFieldIds,
        legacyCandidateFieldIds: input.legacyCandidateFieldIds,
        shadowDecisionMap,
      }),
    });

    logger.info({
      event: "field_exposure.shadow_parity_summary",
      tenantId: input.tenantId,
      eventType: input.eventType,
      workspaceType,
      surface: input.surface,
      matches: parityReport.matches,
      mismatchCount: parityReport.mismatchCount,
      fieldCount: parityReport.fieldReports.length,
    });

    if (parityReport.mismatchCount > 0) {
      recordFieldExposureEngineShadowMismatch({
        tenantId: input.tenantId,
        eventType: input.eventType,
        surface: input.surface,
        mismatchCount: parityReport.mismatchCount,
      });
    }

    const observedFieldArtifacts: ObservedFieldArtifact[] = [];

    for (const report of parityReport.fieldReports) {
      const registryEntry = registryById.get(report.fieldId);
      const shadowDecision = shadowDecisionMap.get(report.fieldId);
      const driftClassification =
        shadowDecision === undefined
          ? null
          : classifyShadowDrift({
              fieldId: report.fieldId,
              legacyEligibleFieldIds: input.legacyEligibleFieldIds,
              legacyCandidateFieldIds: input.legacyCandidateFieldIds,
              shadowDecision,
              registryField:
                registryEntry === undefined
                  ? { fieldId: report.fieldId, exists: false }
                  : {
                      fieldId: report.fieldId,
                      exists: true,
                      ...(registryEntry.tags == null ? {} : { tags: registryEntry.tags }),
                    },
              fieldPolicy: fieldPolicySnapshot,
              mismatch: report.mismatch,
              shadowSurface: input.surface,
              normalizedTriggerName,
              rawEventType: input.eventType,
            });

      const policyHypothesis =
        shadowDecision === undefined
          ? null
          : inferExposurePolicyHypothesis({
              fieldId: report.fieldId,
              legacyEligible: report.isPresentInEligibleFields,
              legacyCandidate: report.isPresentInCandidateFields,
              shadowDecision,
              driftClassification,
              registrySnapshot:
                registryEntry === undefined
                  ? { fieldId: report.fieldId, exists: false }
                  : {
                      fieldId: report.fieldId,
                      exists: true,
                      ...(registryEntry.tags == null ? {} : { tags: registryEntry.tags }),
                    },
              fieldPolicySnapshot,
              surface: input.surface,
              audience: "external_channel",
              trigger: normalizedTriggerName,
            });

      logger.info({
        event: "field_exposure.shadow_parity",
        tenantId: input.tenantId,
        eventType: input.eventType,
        workspaceType,
        surface: input.surface,
        fieldId: report.fieldId,
        shadowState: report.shadowState,
        isEligible: report.isPresentInEligibleFields,
        isCandidate: report.isPresentInCandidateFields,
        mismatch: report.mismatch,
        driftClassification,
        policyHypothesis,
      });

      if (shadowDecision !== undefined) {
        observedFieldArtifacts.push({
          fieldId: report.fieldId,
          driftClassification,
          policyHypothesis,
          shadowDecision,
          legacyEligible: report.isPresentInEligibleFields,
          legacyCandidate: report.isPresentInCandidateFields,
        });
      }
    }

    const observedExposureModel = extractObservedExposureModel({
      surfaces: [input.surface],
      triggers: [normalizedTriggerName],
      fieldArtifacts: observedFieldArtifacts,
      registrySnapshot: registryCatalog.map((field) => ({
        fieldId: field.id,
        exists: true,
        ...(field.tags == null ? {} : { tags: field.tags }),
      })),
      fieldPolicySnapshot,
      legacyEligibleFieldIds: input.legacyEligibleFieldIds,
      legacyCandidateFieldIds: input.legacyCandidateFieldIds,
    });

    logger.info({
      event: "field_exposure.observed_model",
      tenantId: input.tenantId,
      eventType: input.eventType,
      workspaceType,
      surface: input.surface,
      observedExposureModel,
    });
  } catch (error) {
    logger.warn({
      event: "field_exposure_decision_engine.shadow.failed",
      tenantId: input.tenantId,
      eventType: input.eventType,
      err: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isIntegrationDeliveryDispatcherEnabled(): boolean {
  return process.env.INTEGRATION_DELIVERY_ENABLED?.trim().toLowerCase() === "true";
}

export type DispatchIntegrationDomainEventDeps = {
  readonly policyEngine?: IntegrationPolicyEngine;
  readonly deliveryRepository?: ReturnType<typeof createIntegrationDeliveryRepository>;
  readonly resolveWorkspaceType?: typeof resolveWorkspaceTypeForTenant;
  readonly enrichCanonicalDeliveryPayload?: typeof enrichCanonicalDeliveryPayload;
  readonly resolveDeliveryReferenceDisplayValues?: typeof resolveDeliveryReferenceDisplayValues;
  readonly resolvePersistedExposureProfileForContext?: typeof resolvePersistedExposureProfileForContext;
  readonly resolveExposureDecision?: typeof resolveExposureDecision;
  readonly runFieldExposureDecisionEngineShadow?: typeof runForwardFieldExposureDecisionEngineShadow;
  readonly resolveForwardEngineDecisionMap?: typeof resolveForwardEngineDecisionMap;
};

function deliveryFieldPolicyPayload(
  policy: ResolvedDeliveryFieldPolicy | null,
  enriched: CanonicalDeliveryPayload | null,
  messageTemplate: string | null,
  fieldDecorations: ExposureFieldDecorations | null,
  fieldExposureDecision: FieldExposureDecision,
  shadowExposure: Awaited<ReturnType<typeof resolveFieldExposureShadowDiagnostics>>,
  runtimeMetadata: FieldExposureRuntimeMetadata,
  activeFieldIds: readonly string[]
): Record<string, unknown> {
  const compatibilityCandidateFieldIds = fieldExposureDecision.candidateFieldIds;

  if (policy === null) {
    return {
      fieldExposureDecision,
      ...(messageTemplate === null ? {} : { integrationDeliveryMessageTemplate: messageTemplate }),
      ...(shadowExposure === null ? {} : { fieldExposureShadow: shadowExposure }),
      fieldExposureRuntime: runtimeMetadata,
    };
  }

  return {
    fieldExposureDecision,
    integrationDeliveryCandidateFieldIds: compatibilityCandidateFieldIds,
    integrationDeliveryFieldIds: activeFieldIds,
    integrationDeliveryFieldValues: enriched?.fieldValues ?? {},
    ...(messageTemplate === null ? {} : { integrationDeliveryMessageTemplate: messageTemplate }),
    ...(fieldDecorations === null ? {} : { integrationDeliveryFieldDecorations: fieldDecorations }),
    ...(shadowExposure === null ? {} : { fieldExposureShadow: shadowExposure }),
    fieldExposureRuntime: runtimeMetadata,
  };
}

/**
 * Maps a published domain event to integration delivery jobs via IntegrationPolicyEngine.
 * Called from outbox relay AFTER workspace side effects — never performs provider HTTP.
 */
export async function dispatchIntegrationDomainEvent(
  row: WorkspaceOutboxPublishedRow,
  deps: DispatchIntegrationDomainEventDeps = {}
): Promise<number> {
  if (!isIntegrationDeliveryDispatcherEnabled()) {
    return 0;
  }

  if (!row.domainEventId.trim()) {
    return 0;
  }

  const policyEngine = deps.policyEngine ?? createIntegrationPolicyEngine();
  const deliveryRepository = deps.deliveryRepository ?? createIntegrationDeliveryRepository();
  const resolveWorkspaceType = deps.resolveWorkspaceType ?? resolveWorkspaceTypeForTenant;
  const enrichDeliveryPayload =
    deps.enrichCanonicalDeliveryPayload ?? enrichCanonicalDeliveryPayload;
  const resolveReferenceDisplayValues =
    deps.resolveDeliveryReferenceDisplayValues ?? resolveDeliveryReferenceDisplayValues;
  const resolvePersistedProfile =
    deps.resolvePersistedExposureProfileForContext ?? resolvePersistedExposureProfileForContext;
  const resolveExposure = deps.resolveExposureDecision ?? resolveExposureDecision;
  const runShadow =
    deps.runFieldExposureDecisionEngineShadow ?? runForwardFieldExposureDecisionEngineShadow;
  const buildEngineDecisionMap =
    deps.resolveForwardEngineDecisionMap ?? resolveForwardEngineDecisionMap;
  const runtimeMode = resolveFieldExposureRuntimeMode();

  const workspaceType = await resolveWorkspaceType(row.tenantId);
  const workspacePlugin = await resolveWorkspacePluginForType(workspaceType);
  const projectCanonicalDeliveryFields =
    workspacePlugin.integrationSurface?.projectCanonicalDeliveryFields;
  const payload = resolveIntegrationDispatchPayload(row);

  const decisions = await policyEngine.evaluate({
    tenantId: row.tenantId,
    eventType: row.eventType,
    workspaceType,
  });

  let enqueued = 0;

  for (const decision of decisions) {
    const profileContext = resolveDeliveryExposureProfileContext(row.eventType);
    const profile =
      workspaceType === null
        ? null
        : await resolvePersistedProfile({
            tenantId: row.tenantId,
            context: {
              workspaceType,
              entityType: profileContext.entityType ?? "tour",
              surface: decision.exposureCoordinate.surface,
              audience: decision.exposureCoordinate.audience,
              trigger: decision.exposureCoordinate.trigger,
            },
          });
    const engineDecisions =
      workspaceType === null
        ? undefined
        : await (async () => {
            try {
              return await buildEngineDecisionMap({
                tenantId: row.tenantId,
                eventType: row.eventType,
                workspaceType,
                surface: decision.exposureCoordinate.surface,
                audience: decision.exposureCoordinate.audience,
                trigger: decision.exposureCoordinate.trigger,
                payload,
                exposureIntent: decision.exposureIntent,
                exposureProfile: profile,
              });
            } catch (error) {
              logger.warn({
                event: "field_exposure_engine.selector.failed",
                tenantId: row.tenantId,
                eventType: row.eventType,
                err: error instanceof Error ? error.message : String(error),
              });
              return undefined;
            }
          })();

    const resolvedExposure =
      profile === null
        ? null
        : await resolveExposure({
            tenantId: row.tenantId,
            workspaceType,
            eventType: row.eventType,
            exposureSurface: decision.exposureCoordinate.surface,
            payload,
            profile,
            exposureIntent: decision.exposureIntent,
            engineDecisions,
          });

    const deliveryPolicy = resolvedExposure?.deliveryPolicy ?? null;
    const messageTemplate = resolvedExposure?.messageTemplate ?? null;
    const fieldDecorations = resolvedExposure?.fieldDecorations ?? null;
    const fieldExposureDecision = resolvedExposure?.decision;
    const nativeIntentMissing =
      decision.exposureIntent == null &&
      fieldExposureDecision?.selectionSource === "exposure_profile_defaults";
    const activeDeliveryFieldIds = resolveActiveDeliveryFieldIds({
      fieldExposureDecision,
    });
    const exposureRuntime = fieldExposureRuntimeMetadata(runtimeMode, {
      selectionSource: fieldExposureDecision?.selectionSource ?? "exposure_profile_defaults",
      nativeIntentMissing,
      engineSelectorMissing: activeDeliveryFieldIds.engineSelectorMissing,
    });

    logger.info({
      event: "field_exposure.runtime_truth",
      tenantId: row.tenantId,
      eventType: row.eventType,
      provider: decision.provider,
      connectionId: decision.connectionId,
      runtimeMode,
      truthSource: resolveFieldExposureRuntimeTruthSource({
        engineSelectorMissing: activeDeliveryFieldIds.engineSelectorMissing,
      }),
      coordinate: decision.exposureCoordinate,
      selectionSource: exposureRuntime.selectionSource,
      activeFieldIdCount: activeDeliveryFieldIds.fieldIds.length,
      engineSelectorMissing: activeDeliveryFieldIds.engineSelectorMissing,
    });

    if (activeDeliveryFieldIds.engineSelectorMissing) {
      recordFieldExposureEngineSelectorFailure({
        tenantId: row.tenantId,
        eventType: row.eventType,
        surface: decision.exposureCoordinate.surface,
      });
      if (isFieldExposureEngineFailClosedEnabled()) {
        logger.warn({
          event: "field_exposure_engine.dispatch_skipped",
          tenantId: row.tenantId,
          eventType: row.eventType,
          provider: decision.provider,
          connectionId: decision.connectionId,
          reason: "engine_selector_missing",
        });
        continue;
      }
    }

    if (fieldExposureDecision?.engineSelectedFieldIds !== undefined) {
      const selectorParity = resolveExposureSelectorParity({
        legacyEligibleFieldIds: deliveryPolicy?.eligibleFieldIds ?? [],
        engineSelectedFieldIds: fieldExposureDecision.engineSelectedFieldIds,
      });

      logger.info({
        event: "field_exposure.selector_parity",
        tenantId: row.tenantId,
        eventType: row.eventType,
        provider: decision.provider,
        connectionId: decision.connectionId,
        runtimeMode,
        coordinate: decision.exposureCoordinate,
        matches: selectorParity.matches,
        mismatchCount: selectorParity.mismatchCount,
        legacyFieldCount: selectorParity.legacyFieldCount,
        engineFieldCount: selectorParity.engineFieldCount,
        legacyOnlyFieldIds: selectorParity.legacyOnlyFieldIds,
        engineOnlyFieldIds: selectorParity.engineOnlyFieldIds,
      });
    }

    const referenceDisplayValues =
      deliveryPolicy === null
        ? {}
        : await resolveReferenceDisplayValues({
            tenantId: row.tenantId,
            workspaceType,
            payload,
            eligibleFieldIds: activeDeliveryFieldIds.fieldIds,
            definitions: deliveryPolicy.definitions,
          });

    const enriched =
      deliveryPolicy === null
        ? null
        : enrichDeliveryPayload({
            payload,
            eligibleFieldIds: activeDeliveryFieldIds.fieldIds,
            definitions: deliveryPolicy.definitions,
            referenceDisplayValues,
            projectCanonicalDeliveryFields,
          });

    const authoritativeDeliveryFields = {
      candidateFieldIds: deliveryPolicy?.candidateFieldIds ?? [],
      eligibleFieldIds: activeDeliveryFieldIds.fieldIds,
      fieldValues: enriched?.fieldValues ?? {},
      messageTemplate,
    };
    const shadowExposure =
      runtimeMode === "cutover"
        ? null
        : await resolveFieldExposureShadowDiagnostics({
            workspaceType,
            surface: decision.exposureCoordinate.surface,
            eventType: row.eventType,
            connectionId: decision.connectionId,
            basePayload: payload,
            deliveryPolicy,
            enriched,
            exposureIntent: decision.exposureIntent,
            messageTemplate,
            authoritativeDeliveryFields,
          });

    if (shadowExposure !== null && !shadowExposure.parity.matches) {
      recordFieldExposureShadowParityMismatch({
        tenantId: row.tenantId,
        eventType: row.eventType,
        provider: decision.exposureCoordinate.surface,
        mismatchCount: shadowExposure.parity.mismatches.length,
      });
    }

    if (fieldExposureDecision !== undefined) {
      recordFieldExposureDecisionAudited({
        tenantId: row.tenantId,
        eventType: row.eventType,
        provider: decision.exposureCoordinate.surface,
        selectionSource: fieldExposureDecision.selectionSource,
        resolverVersion: fieldExposureDecision.resolverVersion,
      });
      recordFieldExposureRuntimeSelection({
        tenantId: row.tenantId,
        eventType: row.eventType,
        provider: decision.exposureCoordinate.surface,
        runtimeMode,
        selectionSource: exposureRuntime.selectionSource,
        nativeIntentMissing: exposureRuntime.nativeIntentMissing,
      });
      if (runtimeMode === "cutover") {
        recordFieldExposureCutoverSelection({
          tenantId: row.tenantId,
          eventType: row.eventType,
          provider: decision.exposureCoordinate.surface,
          selectionSource: exposureRuntime.selectionSource,
          nativeIntentMissing: exposureRuntime.nativeIntentMissing,
        });
      }
    }

    if (runtimeMode === "shadow") {
      try {
        await runShadow({
          tenantId: row.tenantId,
          eventType: row.eventType,
          workspaceType,
          surface: decision.exposureCoordinate.surface,
          audience: decision.exposureCoordinate.audience,
          trigger: decision.exposureCoordinate.trigger,
          payload,
          legacyEligibleFieldIds: authoritativeDeliveryFields.eligibleFieldIds,
          legacyCandidateFieldIds: authoritativeDeliveryFields.candidateFieldIds,
          exposureIntent: decision.exposureIntent,
          exposureProfile: profile,
        });
      } catch (error) {
        logger.warn({
          event: "field_exposure_decision_engine.shadow.failed",
          tenantId: row.tenantId,
          eventType: row.eventType,
          err: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const inserted = await enqueueIntegrationDeliveryJob(deliveryRepository, {
      tenantId: row.tenantId,
      provider: decision.provider,
      capability: decision.capability,
      domainEventId: row.domainEventId,
      eventType: row.eventType,
      payload: {
        ...payload,
        tenantId: row.tenantId,
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        workspaceType,
        integrationConnectionId: decision.connectionId,
        ...(fieldExposureDecision === undefined
          ? {}
          : deliveryFieldPolicyPayload(
              deliveryPolicy,
              enriched,
              messageTemplate,
              fieldDecorations,
              fieldExposureDecision,
              shadowExposure,
              exposureRuntime,
              activeDeliveryFieldIds.fieldIds
            )),
      },
    });
    if (inserted) {
      enqueued += 1;
    }
  }

  return enqueued;
}
