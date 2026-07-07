export const OTP_SEGMENT_LENGTH = 4;

const PERSIAN_DIGIT_OFFSET = "۰".charCodeAt(0) - "0".charCodeAt(0);
const ARABIC_INDIC_DIGIT_OFFSET = "٠".charCodeAt(0) - "0".charCodeAt(0);

function mapLocaleDigitToAscii(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= "۰".charCodeAt(0) && code <= "۹".charCodeAt(0)) {
    return String.fromCharCode(code - PERSIAN_DIGIT_OFFSET);
  }
  if (code >= "٠".charCodeAt(0) && code <= "٩".charCodeAt(0)) {
    return String.fromCharCode(code - ARABIC_INDIC_DIGIT_OFFSET);
  }
  return char;
}

export function normalizeOtpDigits(raw: string): string {
  const normalized = Array.from(raw, mapLocaleDigitToAscii).join("");
  return normalized.replace(/\D/g, "").slice(0, OTP_SEGMENT_LENGTH);
}

export function digitsFromOtpValue(value: string): string[] {
  const normalized = normalizeOtpDigits(value);
  return Array.from({ length: OTP_SEGMENT_LENGTH }, (_, index) => normalized[index] ?? "");
}
