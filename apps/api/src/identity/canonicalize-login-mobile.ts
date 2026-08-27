import {
  normalizeIranMobile,
  resolveIranMobileIdentityLookupKeys,
} from "@app-tour/iran-mobile";

/** Canonical identity key for login / directory storage (Iran → `09…`, else E.164-ish). */
export function canonicalizeLoginMobile(mobile: string): string {
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

  // US dev/smoke numbers without leading + (e.g. 15550001001 → +15550001001)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return trimmed;
}

/** All DB lookup keys for a mobile — bridges legacy `+98…` rows and canonical `09…`. */
export function resolveLoginMobileLookupKeys(mobile: string): readonly string[] {
  const canonical = canonicalizeLoginMobile(mobile);
  const keys = new Set<string>();
  if (canonical.length > 0) {
    keys.add(canonical);
  }
  for (const key of resolveIranMobileIdentityLookupKeys(mobile)) {
    keys.add(key);
  }
  return [...keys];
}
