import { formatCanonicalPathToLabel } from "@/i18n/format-canonical-path-label";
import { resolveGeneratedLabelResolver } from "@/wizard/wizard-label-registry";

/** Well-known catalog enum paths for tour/admin UI (Wave F.c). */
export const WIZARD_CATALOG_ENUM_PATHS = {
  tourKind: "tour.kind",
  transportMode: "transport.mode",
  tourDuration: "tour.duration",
  tourCategoryGroup: "tour.categoryGroup",
} as const;

/** Well-known catalog enum paths for tour/admin UI (Wave F.c). */
export const WIZARD_CATALOG_ENUM_PATHS = {
  tourKind: "tour.kind",
  transportMode: "transport.mode",
  tourDuration: "tour.duration",
  tourCategoryGroup: "tour.categoryGroup",
} as const;

export function resolveWizardFieldLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  canonicalPath: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver != null) {
    return resolver.resolveFieldLabel(translate, canonicalPath);
  }
  return formatCanonicalPathToLabel(canonicalPath);
}

export function resolveWizardStepLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  stepId: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver?.resolveStepLabel != null) {
    return resolver.resolveStepLabel(translate, stepId);
  }
  return formatCanonicalPathToLabel(stepId);
}

export function resolveWizardEnumOptionLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  canonicalPath: string,
  value: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver?.resolveEnumOptionLabel != null) {
    return resolver.resolveEnumOptionLabel(translate, canonicalPath, value);
  }
  return value;
}

export function resolveWizardTourKindLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  tourKind: string
): string {
  return resolveWizardEnumOptionLabel(
    surfaceId,
    translate,
    WIZARD_CATALOG_ENUM_PATHS.tourKind,
    tourKind
  );
}

export function resolveWizardTransportModeLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  mode: string
): string {
  return resolveWizardEnumOptionLabel(
    surfaceId,
    translate,
    WIZARD_CATALOG_ENUM_PATHS.transportMode,
    mode
  );
}

export function resolveWizardTourDurationLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  duration: string
): string {
  return resolveWizardEnumOptionLabel(
    surfaceId,
    translate,
    WIZARD_CATALOG_ENUM_PATHS.tourDuration,
    duration
  );
}

export function resolveWizardTourCategoryGroupLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  categoryGroup: string
): string {
  return resolveWizardEnumOptionLabel(
    surfaceId,
    translate,
    WIZARD_CATALOG_ENUM_PATHS.tourCategoryGroup,
    categoryGroup
  );
}
