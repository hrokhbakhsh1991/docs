import type { ExposureDecision as EngineExposureDecision, FieldDefinition } from "@app-tour/platform-core";

import type { ResolvedDeliveryFieldPolicy } from "../integrations/application/delivery-field-definitions";
import { resolveDeliveryFieldDefinitions } from "../integrations/application/delivery-field-definitions";

import type { ExposureIntent, ExposureFieldDecorations } from "./exposure-intent";
import {
  resolveExposureIntentCandidateFieldIds,
  resolveExposureIntentFieldDecorations,
  resolveExposureIntentTemplateId,
} from "./exposure-intent-delivery-selection";
import { exposureSelectableFieldIds } from "./exposure-field-catalog";
import { restrictFieldExposureCandidates } from "./field-exposure-policy";
import type { ExposureProfile } from "./exposure-profile";
import type { FieldExposureSelectionSource } from "./exposure-runtime-mode";

export const EXPOSURE_RESOLVER_VERSION = "8.0.0" as const;

export type FieldExposureDecision = {
  readonly profileId: string;
  readonly profileVersion: string;
  readonly intentId?: string;
  readonly intentVersion?: string;
  readonly resolverVersion: typeof EXPOSURE_RESOLVER_VERSION;
  readonly selectionSource: FieldExposureSelectionSource;
  readonly candidateFieldIds: readonly string[];
  readonly eligibleFieldIds: readonly string[];
  readonly engineSelectedFieldIds?: readonly string[];
};

export type ResolveExposureDecisionInput = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly eventType: string;
  readonly exposureSurface: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly profile: ExposureProfile;
  readonly exposureIntent: ExposureIntent | null;
  readonly engineDecisions?: ReadonlyMap<string, EngineExposureDecision>;
  readonly resolveDeliveryFieldDefinitions?: typeof resolveDeliveryFieldDefinitions;
};

export type ResolvedExposureDecision = {
  readonly decision: FieldExposureDecision;
  readonly deliveryPolicy: ResolvedDeliveryFieldPolicy | null;
  readonly messageTemplate: string | null;
  readonly fieldDecorations: ExposureFieldDecorations | null;
  readonly definitions: readonly FieldDefinition[];
};

function resolveSelection(input: {
  readonly exposureIntent: ExposureIntent | null;
}): {
  readonly requestedFieldIds: readonly string[] | null;
  readonly messageTemplate: string | null;
  readonly fieldDecorations: ExposureFieldDecorations | null;
  readonly selectionSource: FieldExposureSelectionSource;
} {
  if (input.exposureIntent != null) {
    return {
      requestedFieldIds: resolveExposureIntentCandidateFieldIds(input.exposureIntent),
      messageTemplate: resolveExposureIntentTemplateId(input.exposureIntent),
      fieldDecorations: resolveExposureIntentFieldDecorations(input.exposureIntent),
      selectionSource: "native_exposure_intent",
    };
  }

  return {
    requestedFieldIds: null,
    messageTemplate: null,
    fieldDecorations: null,
    selectionSource: "exposure_profile_defaults",
  };
}

const ENGINE_SELECTED_STATES = new Set<EngineExposureDecision["state"]>(["visible"]);

function resolveEngineCandidateFieldIds(
  engineDecisions: ReadonlyMap<string, EngineExposureDecision> | undefined,
): readonly string[] | undefined {
  if (engineDecisions === undefined) {
    return undefined;
  }

  return [...engineDecisions.keys()].sort((left, right) => left.localeCompare(right));
}

export function resolveEngineSelectedFieldIds(input: {
  readonly candidateFieldIds: readonly string[];
  readonly decisions: ReadonlyMap<string, EngineExposureDecision>;
}): readonly string[] {
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const fieldId of input.candidateFieldIds) {
    if (fieldId.length === 0 || seen.has(fieldId)) {
      continue;
    }
    seen.add(fieldId);

    const decision = input.decisions.get(fieldId);
    if (decision !== undefined && ENGINE_SELECTED_STATES.has(decision.state)) {
      selected.push(fieldId);
    }
  }

  return selected;
}

/**
 * Phase 8d — authoritative exposure resolver consumed by integration dispatch.
 */
export async function resolveExposureDecision(
  input: ResolveExposureDecisionInput,
): Promise<ResolvedExposureDecision> {
  const resolveDefinitions = input.resolveDeliveryFieldDefinitions ?? resolveDeliveryFieldDefinitions;
  const selection = resolveSelection({ exposureIntent: input.exposureIntent });
  const profileDefaultFieldIds =
    selection.requestedFieldIds ?? input.profile.defaultFieldIds;
  const engineCandidateFieldIds = resolveEngineCandidateFieldIds(input.engineDecisions);
  const catalogFieldIds = engineCandidateFieldIds ?? await exposureSelectableFieldIds(input.workspaceType);
  const restrictedCandidateFieldIds =
    engineCandidateFieldIds !== undefined
      ? engineCandidateFieldIds
      : selection.selectionSource === "native_exposure_intent"
        ? profileDefaultFieldIds
        : restrictFieldExposureCandidates({
            allowedCatalogFieldIds: catalogFieldIds,
            candidateFieldIds: profileDefaultFieldIds,
          });

  const definitions =
    (await resolveDefinitions({
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
      eventType: input.eventType,
      exposureSurface: input.exposureSurface,
      payload: input.payload,
    })) ?? [];

  // Profile defaultTemplateId mirrors the integration-surface header seed only — not a custom
  // delivery override. formatIntegrationDeliveryMessage reads the surface header directly.
  const messageTemplate = selection.messageTemplate;
  const resolvedCandidateFieldIds = engineCandidateFieldIds ?? restrictedCandidateFieldIds;
  const engineSelectedFieldIds =
    input.engineDecisions === undefined
      ? undefined
      : resolveEngineSelectedFieldIds({
          candidateFieldIds: resolvedCandidateFieldIds,
          decisions: input.engineDecisions,
        });
  const resolvedDeliveryPolicy: ResolvedDeliveryFieldPolicy | null =
    definitions.length === 0 && resolvedCandidateFieldIds.length === 0
      ? null
      : {
          candidateFieldIds: resolvedCandidateFieldIds,
          eligibleFieldIds: engineSelectedFieldIds ?? [],
          definitions,
        };

  return {
    decision: {
      profileId: input.profile.id,
      profileVersion: input.profile.version,
      ...(input.exposureIntent?.id === undefined
        ? {}
        : { intentId: input.exposureIntent.id }),
      ...(input.exposureIntent?.version === undefined
        ? {}
        : { intentVersion: input.exposureIntent.version }),
      resolverVersion: EXPOSURE_RESOLVER_VERSION,
      selectionSource: selection.selectionSource,
      candidateFieldIds: resolvedCandidateFieldIds,
      eligibleFieldIds: engineSelectedFieldIds ?? [],
      ...(engineSelectedFieldIds === undefined ? {} : { engineSelectedFieldIds }),
    },
    deliveryPolicy: resolvedDeliveryPolicy,
    messageTemplate,
    fieldDecorations: selection.fieldDecorations,
    definitions,
  };
}
