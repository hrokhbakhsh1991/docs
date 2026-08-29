import { normalizeIranMobile } from "@app-tour/iran-mobile";

/**
 * Canonical mobile for portal public-auth BFF + registration UI.
 * Iranian numbers → `09…`; US dev/smoke → `+1…` (matches seeded identity rows).
 */
export function normalizePublicRegistrationMobile(mobile: string): string {
  const trimmed = mobile.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const iran = normalizeIranMobile(trimmed);
  if (iran !== null) {
    return iran;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return trimmed;
}
