import {
  adaptWorkspaceFieldPolicyManifest,
  normalizeIntegrationEventType,
  resolveFieldExposureDecision,
  type ExposureDecision,
  type FieldExposureDecisionInput,
  type NormalizedExposureTrigger,
} from "@app-tour/platform-core";

import { buildDeliveryFieldPolicyEntityState } from "../integrations/application/delivery-field-definitions";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

import { buildExposureFieldCatalog, type ExposureFieldCatalogEntry } from "./exposure-field-catalog";
import type { ExposureIntent } from "./exposure-intent";
import type { ExposureProfile } from "./exposure-profile";
import { FIELD_EXPOSURE_RUNTIME_AUDIENCE } from "./resolve-runtime-truth-source";

export const FIELD_EXPOSURE_ENGINE_FIELD_POLICY_SURFACE = "delivery" as const;

export type FieldExposureEngineInputSnapshot = {
  readonly entityState: FieldExposureDecisionInput["entityState"];
  readonly trigger: FieldExposureDecisionInput["trigger"];
  readonly registryCatalog: readonly ExposureFieldCatalogEntry[];
  readonly adaptedFieldPolicy: {
    readonly surface: typeof FIELD_EXPOSURE_ENGINE_FIELD_POLICY_SURFACE;
    readonly definitions: NonNullable<FieldExposureDecisionInput["fieldPolicy"]>["definitions"];
    readonly rules: NonNullable<FieldExposureDecisionInput["fieldPolicy"]>["rules"];
  } | null;
};

export function mapExposureIntentForEngine(
  intent: ExposureIntent | null | undefined,
): FieldExposureDecisionInput["exposureIntent"] | undefined {
  if (intent == null) {
    return undefined;
  }
  if (intent.mode === "inherit_profile") {
    return { mode: "inherit_profile" };
  }
  if (intent.mode === "disabled") {
    return { mode: "disabled" };
  }
  return {
    mode: "override_fields",
    selectedFieldIds: intent.selectedFieldIds,
  };
}

export function mapExposurePolicyForEngine(input: {
  readonly profile: Pick<ExposureProfile, "id" | "defaultFieldIds"> | null | undefined;
  readonly exposureIntent: ExposureIntent | null | undefined;
}): FieldExposureDecisionInput["exposurePolicy"] | undefined {
  if (input.exposureIntent?.mode === "disabled") {
    return undefined;
  }
  if (input.exposureIntent?.mode === "override_fields") {
    return {
      allowedFieldIds: input.exposureIntent.selectedFieldIds,
      ...(input.profile?.id === undefined ? {} : { profileId: input.profile.id }),
    };
  }
  if (input.profile == null) {
    return undefined;
  }

  return {
    allowedFieldIds: input.profile.defaultFieldIds,
    profileId: input.profile.id,
  };
}

export function buildFieldExposureEngineInputSnapshot(input: {
  readonly workspaceType: string;
  readonly eventType: string;
  readonly trigger?: string;
  readonly normalizedTrigger?: NormalizedExposureTrigger;
  readonly payload: Readonly<Record<string, unknown>>;
}): FieldExposureEngineInputSnapshot {
  const plugin = resolveWorkspacePluginForType(input.workspaceType);
  const entityState = buildDeliveryFieldPolicyEntityState({
    payload: input.payload,
    eventType: input.eventType,
    lifecycle: plugin.lifecycle,
  });
  const trigger =
    input.normalizedTrigger ?? normalizeIntegrationEventType(input.trigger ?? input.eventType);
  const registryCatalog = buildExposureFieldCatalog(input.workspaceType);
  const fieldIds = registryCatalog.map((field) => field.id);
  const adaptedFieldPolicy =
    plugin.fieldPolicy == null
      ? null
      : adaptWorkspaceFieldPolicyManifest({
          workspaceType: input.workspaceType,
          manifest: plugin.fieldPolicy,
          fieldRegistry: plugin.fieldRegistry,
          candidateFieldIds: fieldIds,
        });

  return {
    entityState,
    trigger,
    registryCatalog,
    adaptedFieldPolicy:
      adaptedFieldPolicy === null
        ? null
        : {
            surface: FIELD_EXPOSURE_ENGINE_FIELD_POLICY_SURFACE,
            definitions: adaptedFieldPolicy.definitions,
            rules: adaptedFieldPolicy.rules,
          },
  };
}

export function buildFieldExposureEngineDecisionInput(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly surface: string;
  readonly fieldPolicySurface?: string;
  readonly audience?: string;
  readonly fieldId: string;
  readonly snapshot: FieldExposureEngineInputSnapshot;
  readonly exposureIntent?: ExposureIntent | null;
  readonly exposureProfile?: Pick<ExposureProfile, "id" | "defaultFieldIds"> | null;
}): FieldExposureDecisionInput {
  const registryEntry = input.snapshot.registryCatalog.find((field) => field.id === input.fieldId);
  const fieldPolicySurface =
    input.fieldPolicySurface ?? FIELD_EXPOSURE_ENGINE_FIELD_POLICY_SURFACE;

  return {
    tenantId: input.tenantId,
    workspaceType: input.workspaceType,
    fieldId: input.fieldId,
    entityState: input.snapshot.entityState,
    surface: input.surface,
    audience: input.audience ?? FIELD_EXPOSURE_RUNTIME_AUDIENCE,
    trigger: input.snapshot.trigger,
    registryField:
      registryEntry === undefined
        ? { exists: false }
        : {
            exists: true,
            ...(registryEntry.tags == null ? {} : { tags: registryEntry.tags }),
          },
    fieldPolicy: input.snapshot.adaptedFieldPolicy
      ? {
          surface: fieldPolicySurface as FieldExposureDecisionInput["fieldPolicy"] extends infer T
            ? T extends { surface: infer S }
              ? S
              : never
            : never,
          definitions: input.snapshot.adaptedFieldPolicy.definitions,
          rules: input.snapshot.adaptedFieldPolicy.rules,
        }
      : undefined,
    exposurePolicy: mapExposurePolicyForEngine({
      profile: input.exposureProfile,
      exposureIntent: input.exposureIntent,
    }),
    exposureIntent: mapExposureIntentForEngine(input.exposureIntent),
  };
}

export function buildFieldExposureEngineDecisionMap(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly eventType: string;
  readonly surface: string;
  readonly fieldPolicySurface?: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly normalizedTrigger?: NormalizedExposureTrigger;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly exposureIntent?: ExposureIntent | null;
  readonly exposureProfile?: Pick<ExposureProfile, "id" | "defaultFieldIds"> | null;
}): ReadonlyMap<string, ExposureDecision> {
  const snapshot = buildFieldExposureEngineInputSnapshot({
    workspaceType: input.workspaceType,
    eventType: input.eventType,
    ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
    ...(input.normalizedTrigger === undefined ? {} : { normalizedTrigger: input.normalizedTrigger }),
    payload: input.payload,
  });
  const decisionMap = new Map<string, ExposureDecision>();

  for (const field of snapshot.registryCatalog) {
    decisionMap.set(
      field.id,
      resolveFieldExposureDecision(
        buildFieldExposureEngineDecisionInput({
          tenantId: input.tenantId,
          workspaceType: input.workspaceType,
          surface: input.surface,
          ...(input.fieldPolicySurface === undefined
            ? {}
            : { fieldPolicySurface: input.fieldPolicySurface }),
          ...(input.audience === undefined ? {} : { audience: input.audience }),
          fieldId: field.id,
          snapshot,
          exposureIntent: input.exposureIntent,
          exposureProfile: input.exposureProfile,
        }),
      ),
    );
  }

  return decisionMap;
}
