import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";

import type { ExposureCatalogField } from "./exposure-field-selection";

type WizardTranslator = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Localizes exposure catalog field labels through the workspace wizard message namespace.
 * The exposure catalog carries `adminLabel` seeded from the registry (English); admin UIs
 * surface the operator-facing wizard label keyed by `canonicalPath` instead.
 */
export function localizeExposureCatalogFields(
  fields: readonly ExposureCatalogField[],
  translateWizard: WizardTranslator,
): readonly ExposureCatalogField[] {
  return fields.map((field) => {
    const label = resolveDenaliFieldLabel(translateWizard, field.canonicalPath);
    if (label.trim().length === 0) {
      return field;
    }
    return { ...field, adminLabel: label };
  });
}
