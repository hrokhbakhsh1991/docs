import type { ValidationIssue } from "@app-tour/wizard-navigation";

import { localizeDenaliValidationIssueMessage } from "../../wizard/localize-denali-validation-message";

export type WizardValidationMessageTranslator = {
  readonly has: (key: string) => boolean;
  readonly translate: (key: string, values: { field: string }) => string;
  readonly translateWorkspace: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
};

/** Map structural validation codes first, then canonical platform copy, to operator-facing i18n. */
export function resolveWizardValidationIssueMessage(
  issue: ValidationIssue,
  translator: WizardValidationMessageTranslator,
  fieldLabel: string
): string {
  const code = issue.code?.trim();
  if (code != null && code.length > 0 && translator.has(code)) {
    return translator.translate(code, { field: fieldLabel });
  }
  return localizeDenaliValidationIssueMessage(
    translator.translateWorkspace,
    issue.message,
    fieldLabel
  );
}
