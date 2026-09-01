import { toAsciiDigits } from "@app-tour/iran-mobile";

export { toAsciiDigits };

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** User-facing digit mapping when locale is Persian. */
export function toLocalizedDigits(text: string, locale: string): string {
  if (!locale.startsWith("fa")) {
    return text;
  }
  return text.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/** Integer display for countdowns and labels — logic stays numeric canonical. */
export function formatLocalizedInteger(value: number, locale: string): string {
  if (locale.startsWith("fa")) {
    return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
  }
  return String(value);
}
