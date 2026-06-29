export const REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED =
  "registry_deliverable_migration_seed" as const;
export const PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE =
  "published_wizard_template" as const;
export const NATIVE_PERSISTED_EXPOSURE_PROFILE_SOURCE = "native" as const;

export type ExposureCatalogSource =
  | typeof REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED
  | typeof PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE;

/** Stable product slug for Denali Telegram TourCreated seeded profile. */
export const DENALI_TELEGRAM_TOUR_CREATED_PROFILE_SLUG = "telegram_tour_created" as const;

export type ExposureProfileSource =
  | typeof REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED
  | typeof NATIVE_PERSISTED_EXPOSURE_PROFILE_SOURCE;

export type ExposureProfile = {
  readonly id: string;
  readonly workspaceType: string;
  readonly entityType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly defaultFieldIds: readonly string[];
  readonly defaultTemplateId?: string;
  readonly source: ExposureProfileSource;
  readonly version: string;
};

export type ExposureProfileContext = {
  readonly workspaceType: string | null;
  readonly entityType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

export type ResolveSeededExposureProfileInput = {
  readonly workspaceType: string | null;
  readonly entityType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly defaultFieldIds: readonly string[];
  readonly defaultTemplateId?: string | null;
};

function normalizeProfileIdPart(value: string | null): string {
  const normalized = value?.trim();
  return normalized == null || normalized.length === 0 ? "unknown" : normalized;
}

/**
 * Phase 4 transitional profile view.
 *
 * Defaults are still seeded from legacy selectable field metadata, but callers now
 * cross the ExposureProfile boundary. Native workspace-owned profiles can replace
 * this seed without changing dispatch callers.
 */
export function resolveSeededExposureProfile(
  input: ResolveSeededExposureProfileInput,
): ExposureProfile | null {
  if (input.workspaceType === null || input.workspaceType.trim().length === 0) {
    return null;
  }

  const defaultTemplateId =
    input.defaultTemplateId === undefined || input.defaultTemplateId === null
      ? undefined
      : input.defaultTemplateId.trim().length > 0
        ? input.defaultTemplateId.trim()
        : undefined;

  return {
    id: [
      normalizeProfileIdPart(input.workspaceType),
      normalizeProfileIdPart(input.surface),
      normalizeProfileIdPart(input.trigger),
    ].join("."),
    workspaceType: input.workspaceType,
    entityType: input.entityType,
    surface: input.surface,
    audience: input.audience,
    trigger: input.trigger,
    defaultFieldIds: input.defaultFieldIds,
    ...(defaultTemplateId === undefined ? {} : { defaultTemplateId }),
    source: REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
    version: "migration-seed-v1",
  };
}
