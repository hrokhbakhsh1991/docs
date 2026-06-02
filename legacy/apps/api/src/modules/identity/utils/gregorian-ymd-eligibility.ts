/**
 * Plain-date `YYYY-MM-DD` (Gregorian) validation for profile birth date — no timezone semantics.
 */

export function parseGregorianYmdStrict(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd);
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) {
    return null;
  }
  const dim = daysInGregorianMonth(y, mo);
  if (d > dim) {
    return null;
  }
  return { y, m: mo, d };
}

function isLeapGregorian(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInGregorianMonth(y: number, mo: number): number {
  if (mo === 2) {
    return isLeapGregorian(y) ? 29 : 28;
  }
  if (mo === 4 || mo === 6 || mo === 9 || mo === 11) {
    return 30;
  }
  return 31;
}

export function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const mo = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function isBirthDateYmdEligible(ymd: string, nowMs: number = Date.now()): boolean {
  const parsed = parseGregorianYmdStrict(ymd);
  if (!parsed) {
    return false;
  }
  if (parsed.y < 1900) {
    return false;
  }
  const today = utcTodayYmd();
  if (ymd > today) {
    return false;
  }
  const birthMs = Date.UTC(parsed.y, parsed.m - 1, parsed.d);
  if (birthMs > nowMs) {
    return false;
  }
  const maxAgeMs = 121 * 365.25 * 24 * 60 * 60 * 1000;
  if (nowMs - birthMs > maxAgeMs) {
    return false;
  }
  return true;
}
