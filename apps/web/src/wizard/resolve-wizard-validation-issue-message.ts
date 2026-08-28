import type { ValidationIssue } from "@app-tour/wizard-navigation";

export type WizardValidationMessageTranslator = {
  readonly has: (key: string) => boolean;
  readonly translate: (key: string, values: { field: string }) => string;
};

const MISSING_CANONICAL_PATH_PATTERN = /^No value at canonical path "/;

/** Map structural validation codes to i18n; keep platform canonical copy out of the UI. */
export function resolveWizardValidationIssueMessage(
  issue: ValidationIssue,
  translator: WizardValidationMessageTranslator,
  fieldLabel: string
): string {
  if (
    MISSING_CANONICAL_PATH_PATTERN.test(issue.message) &&
    translator.has("REQUIRED_FIELD_EMPTY")
  ) {
    return translator.translate("REQUIRED_FIELD_EMPTY", { field: fieldLabel });
  }

  const code = issue.code?.trim();
  if (code != null && code.length > 0 && translator.has(code)) {
    return translator.translate(code, { field: fieldLabel });
  }
  return issue.message;
}
