import { normalizePublicRegistrationMobile } from "@app-tour/catalog-registration-auth";

import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";

/** Operator login / invite — Iranian `09…`, US dev `+1…`; accepts legacy `+98…` input. */
export function canonicalizeOperatorLoginPhone(raw: string): string {
  const ascii = normalizeNumericInputValue(raw.trim(), "phone");
  return normalizePublicRegistrationMobile(ascii);
}
