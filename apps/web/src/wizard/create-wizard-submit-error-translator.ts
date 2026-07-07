import type { WizardSubmitErrorTranslator } from "./resolve-wizard-submit-error-message";

type NextIntlNamespaceTranslator = ((
  key: string,
  values?: Record<string, string | number | Date>
) => string) & {
  readonly has: (key: string) => boolean;
};

/** Bridge next-intl namespace translator to wizard submit error resolver (no throw-on-has). */
export function createWizardSubmitErrorTranslator(
  tWizard: NextIntlNamespaceTranslator
): WizardSubmitErrorTranslator {
  return {
    translate: (key, values) => tWizard(key, values),
    has: (key) => tWizard.has(key),
  };
}
