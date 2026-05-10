import { normalizeNumericInput } from "./digit-localization";

/**
 * Strips whitespace and non-phone characters, keeping digits and leading `+`.
 * Persian / Arabic-Indic digits are normalized to ASCII first.
 * Must stay aligned with SQL `phone_normalized(text)` on the API
 * (`1777582000000-AddUsersPhoneOtpFields`).
 */
export function normalizeOtpPhoneInput(phone: string): string {
  const asciiDigits = normalizeNumericInput(phone.trim());
  return asciiDigits.replace(/[^0-9+]/g, "");
}
