const IRAN_MOBILE_CANONICAL = /^09\d{9}$/;

function readDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Canonical Iranian mobile identity: `09xxxxxxxxx` (11 digits).
 * Returns null when input is not a recognizable Iranian mobile.
 */
export function normalizeIranMobile(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let digits = readDigits(trimmed);

  if (digits.startsWith("0098") && digits.length >= 14) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("98") && digits.length === 12) {
    const local = `0${digits.slice(2)}`;
    return IRAN_MOBILE_CANONICAL.test(local) ? local : null;
  }

  if (digits.startsWith("09") && digits.length === 11) {
    return IRAN_MOBILE_CANONICAL.test(digits) ? digits : null;
  }

  return null;
}

export function isValidIranMobile(raw: string): boolean {
  return normalizeIranMobile(raw) !== null;
}

/** User-facing display — never `+98` / `0098` / bare `98` for Iranian numbers. */
export function formatIranMobileForDisplay(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return "";
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const canonical = normalizeIranMobile(trimmed);
  return canonical ?? trimmed;
}

/** SMS / auth provider boundary only — never use in UI or domain persistence keys. */
export function toIranMobileE164(canonical09: string): string {
  const canonical = normalizeIranMobile(canonical09);
  if (canonical === null) {
    throw new Error("IRAN_MOBILE_E164_INVALID");
  }
  return `+98${canonical.slice(1)}`;
}

/** Lookup keys for legacy rows stored as `+98…` and new `09…` canonical rows. */
export function resolveIranMobileIdentityLookupKeys(raw: string): readonly string[] {
  const canonical = normalizeIranMobile(raw);
  if (canonical === null) {
    return [];
  }
  const e164 = toIranMobileE164(canonical);
  return canonical === e164 ? [canonical] : [canonical, e164];
}

/** ILIKE patterns so user search matches both `09…` and legacy `+98…` rows. */
export function buildIranMobileSearchPatterns(search: string): readonly string[] {
  const trimmed = search.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const patterns = new Set<string>([`%${trimmed}%`]);
  const canonical = normalizeIranMobile(trimmed);
  if (canonical !== null) {
    patterns.add(`%${canonical}%`);
    patterns.add(`%${toIranMobileE164(canonical)}%`);
  }
  if (trimmed.startsWith("09")) {
    patterns.add(`%+98${trimmed.slice(1)}%`);
    patterns.add(`%98${trimmed.slice(1)}%`);
  }
  if (trimmed.startsWith("+98")) {
    patterns.add(`%0${trimmed.slice(3)}%`);
  }
  return [...patterns];
}
