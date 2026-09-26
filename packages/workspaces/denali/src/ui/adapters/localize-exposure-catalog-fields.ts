import {
  isUnresolvedDenaliTranslation,
  resolveDenaliFieldLabel,
  type DenaliTranslator,
} from "./field-labels";
import { formatCanonicalPathToLabel } from "./format-canonical-path-label";

/**
 * Minimal catalog field shape for exposure localization.
 * Callers may pass richer objects; only `adminLabel` is rewritten.
 */
export type ExposureCatalogFieldForLocalization = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
};

function resolveDenaliFieldDescription(
  translateWizard: DenaliTranslator,
  canonicalPath: string,
): string | null {
  if (canonicalPath === "denali.location-zones") {
    const key = "fieldDescriptions.locationZones";
    if (typeof translateWizard.has === "function" && !translateWizard.has(key)) {
      return null;
    }
    try {
      const translated = translateWizard(key);
      return isUnresolvedDenaliTranslation(key, translated) ? null : translated;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Localizes exposure catalog field labels through the workspace wizard message namespace.
 * Catalog rows often carry English `adminLabel` from the registry; admin UIs surface
 * the operator-facing wizard label keyed by `canonicalPath` instead.
 */
export function localizeExposureCatalogFields<T extends ExposureCatalogFieldForLocalization>(
  fields: readonly T[],
  translateWizard: DenaliTranslator
): readonly T[] {
  return fields.map((field) => {
    const label = resolveDenaliFieldLabel(translateWizard, field.canonicalPath);
    const description = resolveDenaliFieldDescription(translateWizard, field.canonicalPath);
    const localized = {
      ...field,
      ...(description === null ? {} : { adminDescription: description }),
    };
    if (
      field.adminLabel !== undefined &&
      label === formatCanonicalPathToLabel(field.canonicalPath)
    ) {
      return localized;
    }
    return { ...localized, adminLabel: label };
  });
}
