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
  field: Pick<ExposureCatalogFieldForLocalization, "id" | "canonicalPath">,
): string | null {
  // The registry's stable identity is the field id.  Some seeded registry
  // rows expose the underlying wizard path (`startPoint`) as canonicalPath;
  // checking only canonicalPath leaks the English registry description.
  if (field.id === "denali.location-zones" || field.canonicalPath === "denali.location-zones") {
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
    const description = resolveDenaliFieldDescription(translateWizard, field);
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
