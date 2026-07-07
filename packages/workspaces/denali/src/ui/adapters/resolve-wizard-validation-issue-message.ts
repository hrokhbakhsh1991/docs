import type { ValidationIssue } from "@app-tour/wizard-navigation";

export type WizardValidationMessageTranslator = {
  readonly has: (key: string) => boolean;
  readonly translate: (key: string, values: { field: string }) => string;
};

/** Map structural validation codes to i18n; fall back to platform message. */
export function resolveWizardValidationIssueMessage(
  issue: ValidationIssue,
  translator: WizardValidationMessageTranslator,
  fieldLabel: string
): string {
  const code = issue.code?.trim();
  if (code != null && code.length > 0 && translator.has(code)) {
    return translator.translate(code, { field: fieldLabel });
  }
  return issue.message;
}
