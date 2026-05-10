/** Mirrors `@repo/digit-localization` / web `otp-phone-normalize` for consistent OTP phone parsing. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toEnglishDigitsForPhone(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const pi = PERSIAN_DIGITS.indexOf(d);
    if (pi !== -1) {
      return String(pi);
    }
    const ai = ARABIC_INDIC_DIGITS.indexOf(d);
    return ai !== -1 ? String(ai) : d;
  });
}

/**
 * Strips whitespace and non-phone characters, keeping digits and leading `+`.
 * Persian / Arabic-Indic digits map to ASCII first (aligned with web `otp-phone-normalize`).
 * Must stay aligned with SQL `phone_normalized(text)` (Unicode-aware); see migration
 * `1777593600000-PhoneNormalizedUnicodeDigits`.
 */
export function normalizeOtpPhoneInput(phone: string): string {
  return toEnglishDigitsForPhone(phone.trim()).replace(/[^0-9+]/g, "");
}
