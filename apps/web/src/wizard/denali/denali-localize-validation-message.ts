type DenaliTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string;

/** Map platform canonical validation copy to operator-facing Denali wizard messages. */
export function localizeDenaliValidationIssueMessage(
  t: DenaliTranslator,
  message: string,
  fieldLabel: string
): string {
  if (/^No value at canonical path "/.test(message)) {
    return t("validation.requiredField", { field: fieldLabel });
  }
  if (/expects kind "number" but got object/.test(message)) {
    return t("validation.invalidNumber", { field: fieldLabel });
  }
  if (/expects kind "number" but got/.test(message)) {
    return t("validation.invalidNumber", { field: fieldLabel });
  }
  if (/expects kind "boolean" but got/.test(message)) {
    return t("validation.invalidBoolean", { field: fieldLabel });
  }
  if (/expects kind "text" but got/.test(message)) {
    return t("validation.invalidText", { field: fieldLabel });
  }
  if (/expects kind "string" but got/.test(message)) {
    return t("validation.invalidText", { field: fieldLabel });
  }
  return message;
}
