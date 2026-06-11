import { WIZARD_FIELD_ID_ATTR, WIZARD_FIELD_PATH_ATTR } from "./types";

export type WizardFieldPathAttributes = {
  readonly [WIZARD_FIELD_PATH_ATTR]: string;
  readonly [WIZARD_FIELD_ID_ATTR]: string;
};

/**
 * Stable DOM markers for {@link focusWizardField} — use on field wrappers and composites.
 */
export function wizardFieldPathAttributes(
  canonicalPath: string,
  fieldId?: string
): WizardFieldPathAttributes {
  return {
    [WIZARD_FIELD_PATH_ATTR]: canonicalPath,
    [WIZARD_FIELD_ID_ATTR]: fieldId ?? canonicalPath,
  };
}
