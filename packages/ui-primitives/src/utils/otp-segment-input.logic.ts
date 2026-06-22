export const OTP_SEGMENT_LENGTH = 4;

export function normalizeOtpDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_SEGMENT_LENGTH);
}

export function digitsFromOtpValue(value: string): string[] {
  const normalized = normalizeOtpDigits(value);
  return Array.from({ length: OTP_SEGMENT_LENGTH }, (_, index) => normalized[index] ?? "");
}
