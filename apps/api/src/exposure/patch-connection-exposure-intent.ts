import {
  exposureSelectableCatalogFieldIdsForTenant,
} from "./exposure-catalog.service";
import type { ExposureIntentMode, ExposureFieldDecorations } from "./exposure-intent";
import type { UpsertExposureIntentInput } from "./exposure-intent.repository";
import { createExposureIntentRepository } from "./create-exposure-intent-repository";
import {
  mapLegacyDeliveryIntentFields,
  resolveLegacyDeliveryExposureProfile,
} from "./legacy-delivery-exposure-mapper";
import { resolveRegistrySeededExposureProfile } from "./resolve-registry-seeded-exposure-profile";
import { buildConnectionExposureIntentScope } from "./connection-exposure-intent-scope";

export type PatchConnectionExposureIntentInput = {
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly provider: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations?: ExposureFieldDecorations | null;
  readonly templateId?: string | null;
  readonly enabled: boolean;
  readonly updatedByUserId?: string | null;
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
};

function normalizeOptionalExposureDimension(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

export async function buildConnectionExposureIntentUpsert(
  input: PatchConnectionExposureIntentInput,
): Promise<UpsertExposureIntentInput | null> {
  const legacyProfile = await resolveLegacyDeliveryExposureProfile({
    workspaceType: input.workspaceType,
    provider: input.provider,
    eventType: input.eventType,
  });
  if (legacyProfile === null) {
    return null;
  }

  const surface = normalizeOptionalExposureDimension(input.surface) ?? legacyProfile.surface;
  const audience =
    normalizeOptionalExposureDimension(input.audience) ?? legacyProfile.audience;
  const trigger = normalizeOptionalExposureDimension(input.trigger) ?? input.eventType;

  const effectiveProfile =
    await resolveRegistrySeededExposureProfile({
      workspaceType: input.workspaceType,
      entityType: legacyProfile.entityType,
      surface,
      audience,
      trigger,
    }) ?? {
      ...legacyProfile,
      surface,
      audience,
      trigger,
    };

  const fields = mapLegacyDeliveryIntentFields({
    enabled: input.enabled,
    selectedFieldIds: input.selectedFieldIds,
    templateId: input.templateId,
  });
  const mode: ExposureIntentMode = fields.mode;

  return {
    tenantId: input.tenantId,
    workspaceType: input.workspaceType,
    profileId: effectiveProfile.id,
    entityType: effectiveProfile.entityType,
    surface,
    audience,
    trigger,
    scope: buildConnectionExposureIntentScope({
      connectionId: input.connectionId,
      eventType: input.eventType,
    }),
    mode,
    selectedFieldIds: fields.selectedFieldIdsForStorage,
    ...(input.fieldDecorations === undefined ? {} : { fieldDecorations: input.fieldDecorations }),
    templateOverrideId: fields.templateOverrideId,
    updatedByUserId: input.updatedByUserId ?? null,
  };
}

export async function patchConnectionExposureIntent(
  input: PatchConnectionExposureIntentInput,
): Promise<void> {
  const upsertInput = await buildConnectionExposureIntentUpsert(input);
  if (upsertInput === null) {
    return;
  }
  await createExposureIntentRepository().upsert(upsertInput);
}

export async function exposureSelectableCatalogFieldIds(
  tenantId: string,
  workspaceType: string | null,
): Promise<ReadonlySet<string>> {
  return exposureSelectableCatalogFieldIdsForTenant(tenantId, workspaceType);
}
