"use client";

import { useLocale } from "next-intl";
import { useCallback, type ChangeEventHandler } from "react";

import {
  normalizeNumericInputValue,
  toLocalizedDigits,
  type NumericInputMode,
} from "./format-localized-digits";
import type { AppLocale } from "./routing";

export type UseLocalizedNumericInputOptions = {
  readonly value: string;
  readonly onChange: (asciiValue: string) => void;
  readonly mode?: NumericInputMode;
  readonly maxLength?: number;
};

/** Binds a text input: Persian display when locale is fa, ASCII value in state/API. */
export function useLocalizedNumericInput({
  value,
  onChange,
  mode = "digits",
  maxLength,
}: UseLocalizedNumericInputOptions) {
  const locale = useLocale() as AppLocale;
  const displayValue = toLocalizedDigits(value, locale);

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      let next = normalizeNumericInputValue(event.target.value, mode);
      if (maxLength !== undefined) {
        next = next.slice(0, maxLength);
      }
      onChange(next);
    },
    [maxLength, mode, onChange]
  );

  const inputMode =
    mode === "phone" ? ("tel" as const) : mode === "decimal" ? ("decimal" as const) : ("numeric" as const);

  return {
    value: displayValue,
    onChange: handleChange,
    type: "text" as const,
    inputMode,
    lang: locale === "fa" ? ("fa-IR" as const) : undefined,
    dir: "ltr" as const,
    className: "text-start",
  };
}
