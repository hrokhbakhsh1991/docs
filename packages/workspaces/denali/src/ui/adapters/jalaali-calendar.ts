/**
 * Jalali (Persian) ↔ Gregorian conversion via Intl Persian calendar.
 * INV-DENALI-CAL-01 — storage/API values remain Gregorian ISO (YYYY-MM-DD).
 * Reverse mapping searches civil days with the same forward Intl conversion
 * (no second formula, no nested year/month/day scan).
 */

export type JalaaliDate = { readonly jy: number; readonly jm: number; readonly jd: number };
export type GregorianDate = { readonly gy: number; readonly gm: number; readonly gd: number };

const PERSIAN_PARTS_FORMATTER = new Intl.DateTimeFormat("en-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  numberingSystem: "latn",
});

/** Search window around Nowruz of `jy` — covers a full Jalali year plus padding. */
const JALAALI_TO_GREGORIAN_DAY_RADIUS = 400;

function persianPartsFromDate(date: Date): JalaaliDate {
  const parts = PERSIAN_PARTS_FORMATTER.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { jy: read("year"), jm: read("month"), jd: read("day") };
}

function compareJalaali(left: JalaaliDate, jy: number, jm: number, jd: number): number {
  if (left.jy !== jy) {
    return left.jy - jy;
  }
  if (left.jm !== jm) {
    return left.jm - jm;
  }
  return left.jd - jd;
}

export function gregorianToJalaali(gy: number, gm: number, gd: number): JalaaliDate {
  return persianPartsFromDate(new Date(gy, gm - 1, gd));
}

export function jalaaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
    throw new RangeError(`Invalid Jalali date: ${jy}/${jm}/${jd}`);
  }
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    throw new RangeError(`Invalid Jalali date: ${jy}/${jm}/${jd}`);
  }

  const anchor = new Date(jy + 621, 2, 21);
  let lo = -JALAALI_TO_GREGORIAN_DAY_RADIUS;
  let hi = JALAALI_TO_GREGORIAN_DAY_RADIUS;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + mid);
    const gy = candidate.getFullYear();
    const gm = candidate.getMonth() + 1;
    const gd = candidate.getDate();
    const jalali = gregorianToJalaali(gy, gm, gd);
    const cmp = compareJalaali(jalali, jy, jm, jd);
    if (cmp === 0) {
      return { gy, gm, gd };
    }
    if (cmp < 0) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  throw new RangeError(`Invalid Jalali date: ${jy}/${jm}/${jd}`);
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) {
    return 31;
  }
  if (jm <= 11) {
    return 30;
  }
  try {
    jalaaliToGregorian(jy, 12, 30);
    return 30;
  } catch {
    return 29;
  }
}

export function isJalaaliLeapYear(jy: number): boolean {
  return jalaaliMonthLength(jy, 12) === 30;
}
