import type { AppLocale } from "./routing";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const PERSIAN_DIGIT_START = 0x06f0;
const ARABIC_INDIC_DIGIT_START = 0x0660;

export type NumericInputMode = "digits" | "decimal" | "phone";

/** Maps Persian / Arabic-Indic digits to Western ASCII 0-9. */
export function toAsciiDigits(text: string): string {
  let result = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (code >= PERSIAN_DIGIT_START && code <= PERSIAN_DIGIT_START + 9) {
      result += String(code - PERSIAN_DIGIT_START);
      continue;
    }
    if (code >= ARABIC_INDIC_DIGIT_START && code <= ARABIC_INDIC_DIGIT_START + 9) {
      result += String(code - ARABIC_INDIC_DIGIT_START);
      continue;
    }
    result += character;
  }
  return result;
}

/** Normalizes user input to ASCII digits for state/API while allowing fa/en keyboards. */
export function normalizeNumericInputValue(
  raw: string,
  mode: NumericInputMode = "digits"
): string {
  const ascii = toAsciiDigits(raw);
  if (mode === "phone") {
    const trimmed = ascii.trim();
    const hasLeadingPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return hasLeadingPlus ? `+${digits}` : digits;
  }
  if (mode === "decimal") {
    const stripped = ascii.replace(/[^\d.]/g, "");
    const [whole = "", ...fractionParts] = stripped.split(".");
    if (fractionParts.length === 0) {
      return whole;
    }
    return `${whole}.${fractionParts.join("")}`;
  }
  return ascii.replace(/\D/g, "");
}

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

/** Applies Persian digit mapping to an already-formatted string (e.g. legacy manual grouping). */
export function localizeFormattedDigits(formatted: string, locale: AppLocale): string {
  return toLocalizedDigits(formatted, locale);
}
