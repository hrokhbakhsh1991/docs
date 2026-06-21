/**
 * Jalali (Persian) ↔ Gregorian conversion via Intl Persian calendar.
 * Storage/API values remain Gregorian ISO (YYYY-MM-DD).
 */

export type JalaaliDate = { readonly jy: number; readonly jm: number; readonly jd: number };
export type GregorianDate = { readonly gy: number; readonly gm: number; readonly gd: number };

const PERSIAN_PARTS_FORMATTER = new Intl.DateTimeFormat("en-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  numberingSystem: "latn",
});

function persianPartsFromDate(date: Date): JalaaliDate {
  const parts = PERSIAN_PARTS_FORMATTER.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { jy: read("year"), jm: read("month"), jd: read("day") };
}

function gregorianDaysInMonth(gy: number, gm: number): number {
  return new Date(gy, gm, 0).getDate();
}

export function gregorianToJalaali(gy: number, gm: number, gd: number): JalaaliDate {
  return persianPartsFromDate(new Date(gy, gm - 1, gd));
}

export function jalaaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  const searchStart = jy + 621 - 2;
  const searchEnd = jy + 621 + 2;
  for (let gy = searchStart; gy <= searchEnd; gy += 1) {
    for (let gm = 1; gm <= 12; gm += 1) {
      const daysInMonth = gregorianDaysInMonth(gy, gm);
      for (let gd = 1; gd <= daysInMonth; gd += 1) {
        const jalali = persianPartsFromDate(new Date(gy, gm - 1, gd));
        if (jalali.jy === jy && jalali.jm === jm && jalali.jd === jd) {
          return { gy, gm, gd };
        }
      }
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
