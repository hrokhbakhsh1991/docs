"use client";

import { useCallback } from "react";

import {
  normalizeNumericInput,
  toDisplayPersianDigits,
  toEnglishDigits,
  toPersianDigits,
} from "@/lib/digit-localization";

/**
 * React-friendly façade over `@repo/digit-localization` (re-exported as `apps/web/lib/digit-localization`).
 *
 * **Contract**
 * - **User → form / API:** values the user typed (Persian, Arabic-Indic, or English digits) should be passed
 *   through {@link normalizeNumericInput} or {@link toEnglishDigits} (equivalent) before persisting or parsing,
 *   so stored strings use ASCII `0`–`9` in digit positions.
 * - **Stored → display:** use {@link toPersianDigits} or {@link toDisplayPersianDigits} when rendering for a
 *   Persian-digit UI; `toPersian` mirrors `toPersianDigits` for string/number convenience.
 *
 * UI-agnostic (no DOM); pair with inputs in your component.
 */
export function useDigitLocalization() {
  /** Alias for {@link normalizeNumericInput} — use for raw input before updating controlled state. */
  const toEnglish = useCallback((input: string) => normalizeNumericInput(input), []);

  const toPersian = useCallback((input: string | number | undefined) => {
    if (input == null) {
      return "";
    }
    return toPersianDigits(String(input));
  }, []);

  return {
    toEnglishDigits,
    normalizeNumericInput,
    toPersianDigits,
    toDisplayPersianDigits,
    toEnglish,
    toPersian,
  };
}
