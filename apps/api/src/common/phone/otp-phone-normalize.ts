/**
 * Strips whitespace and non-phone characters, keeping digits and leading `+`.
 * Must stay aligned with SQL `phone_normalized(text)` in migration
 * `1777582000000-AddUsersPhoneOtpFields`.
 */
export function normalizeOtpPhoneInput(phone: string): string {
  return phone.trim().replace(/[^0-9+]/g, "");
}
