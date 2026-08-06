import { formatCanonicalPathToLabel } from "@/i18n/format-canonical-path-label";
import { resolveGeneratedLabelResolver } from "@/wizard/wizard-label-registry";

/** Well-known catalog enum paths for tour/admin UI (Wave F.c). */
export const WIZARD_CATALOG_ENUM_PATHS = {
  tourKind: "tour.kind",
  transportMode: "transport.mode",
  tourDuration: "tour.duration",
  tourCategoryGroup: "tour.categoryGroup",
} as const;

function toReadableEnumSlug(value: string): string {
  return value.replace(/[_-]+/g, " ").trim();
}

function isUnresolvedEnumTranslation(key: string, translated: string): boolean {
  const value = translated.trim();
  if (value.length === 0) {
    return true;
  }
  if (value === key) {
    return true;
  }
  if (value === `denali.${key}`) {
    return true;
  }
  if (value.endsWith(`.${key}`)) {
    return true;
  }
  return /^(denali\.)?(fields|composites|validation|steps|enumOptions|tourKinds|transportModes|paymentModes|review)\./.test(
    value
  );
}

type WizardLabelTranslate = ((key: string) => string) & {
  has?: (key: string) => boolean;
};

/**
 * Relative keys under the active workspace namespace (`useTranslations("denali")`).
 * Do not prefix with `denali.` — that doubles the namespace and logs MISSING_MESSAGE.
 */
function buildEnumFallbackKeys(canonicalPath: string, value: string): readonly string[] {
  return [
    canonicalPath === WIZARD_CATALOG_ENUM_PATHS.tourKind ? `tourKinds.${value}` : null,
    canonicalPath === WIZARD_CATALOG_ENUM_PATHS.transportMode ? `transportModes.${value}` : null,
    canonicalPath === WIZARD_CATALOG_ENUM_PATHS.tourDuration
      ? `composites.tourKind.durations.${value}`
      : null,
    canonicalPath === WIZARD_CATALOG_ENUM_PATHS.tourCategoryGroup
      ? `composites.tourKind.categories.${value}`
      : null,
  ].filter((key): key is string => key != null);
}

function readHostEnumTranslation(translate: WizardLabelTranslate, key: string): string | null {
  if (typeof translate.has === "function" && !translate.has(key)) {
    return null;
  }
  let translated = key;
  try {
    translated = translate(key);
  } catch {
    return null;
  }
  return isUnresolvedEnumTranslation(key, translated) ? null : translated;
}

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
  translate: WizardLabelTranslate,
  canonicalPath: string,
  value: string
): string {
  const fallbackKeys = buildEnumFallbackKeys(canonicalPath, value);
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver?.resolveEnumOptionLabel != null) {
    try {
      const resolved = resolver.resolveEnumOptionLabel(translate, canonicalPath, value);
      if (!isUnresolvedEnumTranslation(value, resolved) && !fallbackKeys.includes(resolved)) {
        return resolved;
      }
    } catch {
      // Generated resolver can throw on missing i18n keys in dev; continue with local fallbacks.
    }
  }
  for (const key of fallbackKeys) {
    const translated = readHostEnumTranslation(translate, key);
    if (translated != null) {
      return translated;
    }
  }
  return toReadableEnumSlug(value);
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
