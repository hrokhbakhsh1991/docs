import type { AppLocale } from "./routing";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Maps Western digits 0-9 to Eastern Arabic (Persian) numerals when locale is fa. */
export function toLocalizedDigits(text: string, locale: AppLocale): string {
  if (locale !== "fa") {
    return text;
  }
  return text.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** Locale-aware numeric formatting (Persian digits when locale is fa). */
export function formatLocalizedNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    numberingSystem: locale === "fa" ? "arabext" : "latn",
    ...options,
  }).format(value);
}
