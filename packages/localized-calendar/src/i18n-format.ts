export type AppLocale = "fa" | "en";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export const INTL_LOCALE: Record<AppLocale, string> = {
  fa: "fa-IR",
  en: "en-US",
};

/** Maps Western digits 0-9 to Eastern Arabic (Persian) numerals when locale is fa. */
export function toLocalizedDigits(text: string, locale: AppLocale): string {
  if (locale !== "fa") {
    return text;
  }
  return text.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatLocalizedNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}
