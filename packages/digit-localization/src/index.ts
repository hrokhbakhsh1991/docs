/**
 * Canonical digit conversion for Persian-first UIs: English (ASCII), Persian (U+06F0–U+06F9),
 * Arabic-Indic (U+0660–U+0669), and mixed strings.
 *
 * - Use {@link toEnglishDigits} / {@link normalizeNumericInput} before parsing or sending to APIs.
 * - Use {@link toPersianDigits} for display; {@link toDisplayPersianDigits} accepts `string | number` for placeholders.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Maps Persian and Arabic-Indic digit characters to ASCII `0`–`9`.
 * Existing English digits and all non-digit characters are left unchanged (safe for mixed phone numbers, pasted text, etc.).
 */
export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(d);
    if (persianIndex !== -1) {
      return String(persianIndex);
    }
    const arabicIndex = ARABIC_DIGITS.indexOf(d);
    if (arabicIndex !== -1) {
      return String(arabicIndex);
    }
    return d;
  });
}

/**
 * Maps ASCII digits `0`–`9` to Persian digits. Other characters unchanged (labels, separators, etc. pass through).
 */
export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number.parseInt(d, 10)] ?? d);
}

/**
 * Normalizes localized digits to English ASCII. Equivalent to {@link toEnglishDigits}; use when naming intent is
 * “strip localized numerals before numeric parsing / validation pipelines.”
 */
export function normalizeNumericInput(input: string): string {
  return toEnglishDigits(input);
}

/**
 * Converts a value to Persian digits for display (e.g. placeholders). Empty string when `value` is `null` or `undefined`.
 */
export function toDisplayPersianDigits(value: string | number | undefined): string {
  if (value == null) {
    return "";
  }
  return toPersianDigits(String(value));
}
