/** Canonical E.164-ish form for login lookups (Iran local 09… → +98…). */
export function canonicalizeLoginMobile(mobile: string): string {
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

  return trimmed;
}
