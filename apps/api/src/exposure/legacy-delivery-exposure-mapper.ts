import type { ExposureProfile } from "./exposure-profile";
import { resolveRegistrySeededExposureProfile } from "./resolve-registry-seeded-exposure-profile";

export const LEGACY_DELIVERY_EXTERNAL_CHANNEL_AUDIENCE = "external_channel" as const;
export const LEGACY_DELIVERY_DEFAULT_ENTITY_TYPE = "tour" as const;

export type LegacyDeliveryExposureContextInput = {
  readonly workspaceType: string | null;
  readonly provider: string;
  readonly eventType: string;
  readonly entityType?: string;
};

/**
 * Resolves the seeded exposure profile for a legacy integration delivery context.
 * Shared by Phase 2 read-path adapter and Phase 7b write bridge.
 */
export function resolveLegacyDeliveryExposureProfile(
  input: LegacyDeliveryExposureContextInput,
): ExposureProfile | null {
  return resolveRegistrySeededExposureProfile({
    workspaceType: input.workspaceType,
    entityType: input.entityType ?? LEGACY_DELIVERY_DEFAULT_ENTITY_TYPE,
    surface: input.provider,
    audience: LEGACY_DELIVERY_EXTERNAL_CHANNEL_AUDIENCE,
    trigger: input.eventType,
  });
}

export type LegacyDeliveryIntentFieldMappingInput = {
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
  readonly templateId?: string | null;
};

export type LegacyDeliveryIntentFieldMapping = {
  readonly mode: "inherit_profile" | "override_fields";
  /** Read-path view: empty when inheriting profile. */
  readonly selectedFieldIds: readonly string[];
  /** Write-path storage: null when inheriting profile. */
  readonly selectedFieldIdsForStorage: readonly string[] | null;
  readonly templateOverrideId: string | null;
};

export function mapLegacyDeliveryIntentFields(
  input: LegacyDeliveryIntentFieldMappingInput,
): LegacyDeliveryIntentFieldMapping {
  const templateOverrideId = normalizeLegacyTemplateOverrideId(input.templateId);
  if (!input.enabled) {
    return {
      mode: "inherit_profile",
      selectedFieldIds: [],
      selectedFieldIdsForStorage: null,
      templateOverrideId,
    };
  }

  return {
    mode: "override_fields",
    selectedFieldIds: input.selectedFieldIds,
    selectedFieldIdsForStorage: input.selectedFieldIds,
    templateOverrideId,
  };
}

export function normalizeLegacyTemplateOverrideId(
  templateId: string | null | undefined,
): string | null {
  if (templateId == null) {
    return null;
  }
  const trimmed = templateId.trim();
  return trimmed.length > 0 ? trimmed : null;
}
