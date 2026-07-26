/**
 * Canonical E.164-ish mobile for portal public-auth BFF + registration UI.
 * Mirrors `apps/api` `canonicalizeLoginMobile` so OTP challenges match seeded `+1555…` rows.
 */
export function normalizePublicRegistrationMobile(mobile: string): string {
  const trimmed = mobile.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("09")) {
    return `+98${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("98")) {
    return `+${digits}`;
  }

  // US dev/smoke numbers without leading + (e.g. 15550001001 → +15550001001)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return trimmed;
}
