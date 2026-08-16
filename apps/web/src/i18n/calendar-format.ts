import {
  gregorianToJalaali,
  jalaaliMonthLength,
  jalaaliToGregorian,
  type JalaaliDate,
} from "./jalaali-calendar";
import { formatLocalizedNumber, INTL_LOCALE, toLocalizedDigits } from "./format-localized-digits";
import type { AppLocale } from "./routing";

export type IsoDateParts = { readonly year: number; readonly month: number; readonly day: number };

const PERSIAN_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Week starts Saturday (Iran). */
const PERSIAN_WEEKDAY_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

const GREGORIAN_WEEKDAY_SHORT_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export type CalendarDayCell = {
  readonly day: number;
  readonly month: number;
  readonly year: number;
  /** Gregorian civil ISO `YYYY-MM-DD` — never a Jalali `1405-…` string (INV-DENALI-CAL-01). */
  readonly iso: string;
  readonly inCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
};

export function parseIsoDate(value: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function toIsoDate(parts: IsoDateParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function jalaaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaaliToGregorian(jy, jm, jd);
  return toIsoDate({ year: gy, month: gm, day: gd });
}

export function isoToJalaali(iso: string): JalaaliDate | null {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return null;
  }
  return gregorianToJalaali(parts.year, parts.month, parts.day);
}

export function formatIsoDateLabel(iso: string, locale: AppLocale): string {
  if (iso.trim().length === 0) {
    return "";
  }
  const parts = parseIsoDate(iso);
  if (!parts) {
    return iso;
  }
  if (locale === "fa") {
    const { jy, jm, jd } = gregorianToJalaali(parts.year, parts.month, parts.day);
    return `${toLocalizedDigits(String(jd), locale)} ${PERSIAN_MONTH_NAMES[jm - 1]} ${toLocalizedDigits(String(jy), locale)}`;
  }
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" }).format(date);
}

export function formatCalendarMonthTitle(
  year: number,
  month: number,
  locale: AppLocale
): string {
  if (locale === "fa") {
    return `${PERSIAN_MONTH_NAMES[month - 1]} ${toLocalizedDigits(String(year), locale)}`;
  }
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric" }).format(
    date
  );
}

export function weekdayShortLabels(locale: AppLocale): readonly string[] {
  return locale === "fa" ? PERSIAN_WEEKDAY_SHORT : GREGORIAN_WEEKDAY_SHORT_EN;
}

function saturdayFirstColumnIndex(jsDay: number): number {
  return (jsDay + 1) % 7;
}

function sundayFirstColumnIndex(jsDay: number): number {
  return jsDay;
}

export function buildPersianMonthGrid(
  viewYear: number,
  viewMonth: number,
  selectedIso: string,
  todayIso: string
): CalendarDayCell[] {
  const daysInMonth = jalaaliMonthLength(viewYear, viewMonth);
  const { gy, gm, gd } = jalaaliToGregorian(viewYear, viewMonth, 1);
  const firstWeekday = new Date(gy, gm - 1, gd).getDay();
  const leadingBlanks = saturdayFirstColumnIndex(firstWeekday);
  const cells: CalendarDayCell[] = [];

  for (let blank = 0; blank < leadingBlanks; blank += 1) {
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevDays = jalaaliMonthLength(prevYear, prevMonth);
    const day = prevDays - leadingBlanks + blank + 1;
    const iso = jalaaliToIso(prevYear, prevMonth, day);
    cells.push({
      day,
      month: prevMonth,
      year: prevYear,
      iso,
      inCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = jalaaliToIso(viewYear, viewMonth, day);
    cells.push({
      day,
      month: viewMonth,
      year: viewYear,
      iso,
      inCurrentMonth: true,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - leadingBlanks - daysInMonth + 1;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const iso = jalaaliToIso(nextYear, nextMonth, nextIndex);
    cells.push({
      day: nextIndex,
      month: nextMonth,
      year: nextYear,
      iso,
      inCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  return cells;
}

export function buildGregorianMonthGrid(
  viewYear: number,
  viewMonth: number,
  selectedIso: string,
  todayIso: string
): CalendarDayCell[] {
  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const leadingBlanks = sundayFirstColumnIndex(firstOfMonth.getDay());
  const cells: CalendarDayCell[] = [];

  for (let blank = 0; blank < leadingBlanks; blank += 1) {
    const date = new Date(viewYear, viewMonth - 1, -leadingBlanks + blank + 1);
    const iso = toIsoDate({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    });
    cells.push({
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      iso,
      inCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIsoDate({ year: viewYear, month: viewMonth, day });
    cells.push({
      day,
      month: viewMonth,
      year: viewYear,
      iso,
      inCurrentMonth: true,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  while (cells.length % 7 !== 0) {
    const trailingDay = cells.length - leadingBlanks - daysInMonth + 1;
    const date = new Date(viewYear, viewMonth, trailingDay);
    const iso = toIsoDate({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    });
    cells.push({
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      iso,
      inCurrentMonth: false,
      isToday: iso === todayIso,
      isSelected: iso === selectedIso,
    });
  }

  return cells;
}

export function formatCalendarDayLabel(day: number, locale: AppLocale): string {
  if (locale === "fa") {
    return toLocalizedDigits(String(day), locale);
  }
  return formatLocalizedNumber(day, locale);
}

export function todayIsoDate(): string {
  const now = new Date();
  return toIsoDate({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

export function initialViewFromIso(iso: string, locale: AppLocale): { year: number; month: number } {
  if (iso.trim().length > 0) {
    if (locale === "fa") {
      const jalali = isoToJalaali(iso);
      if (jalali) {
        return { year: jalali.jy, month: jalali.jm };
      }
    }
    const parts = parseIsoDate(iso);
    if (parts) {
      return { year: parts.year, month: parts.month };
    }
  }
  const today = todayIsoDate();
  if (locale === "fa") {
    const jalali = isoToJalaali(today)!;
    return { year: jalali.jy, month: jalali.jm };
  }
  const parts = parseIsoDate(today)!;
  return { year: parts.year, month: parts.month };
}

export function shiftViewMonth(
  year: number,
  month: number,
  delta: number,
  locale: AppLocale
): { year: number; month: number } {
  if (locale === "fa") {
    let jy = year;
    let jm = month + delta;
    while (jm > 12) {
      jm -= 12;
      jy += 1;
    }
    while (jm < 1) {
      jm += 12;
      jy -= 1;
    }
    return { year: jy, month: jm };
  }
  let gy = year;
  let gm = month + delta;
  while (gm > 12) {
    gm -= 12;
    gy += 1;
  }
  while (gm < 1) {
    gm += 12;
    gy -= 1;
  }
  return { year: gy, month: gm };
}
