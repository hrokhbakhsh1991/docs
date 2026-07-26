import { resolveDenaliFieldLabel, type DenaliTranslator } from "./field-labels";

/**
 * Minimal catalog field shape for exposure localization.
 * Callers may pass richer objects; only `adminLabel` is rewritten.
 */
export type ExposureCatalogFieldForLocalization = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
};

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
    if (label.trim().length === 0) {
      return field;
    }
    return { ...field, adminLabel: label };
  });
}
