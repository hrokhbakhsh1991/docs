"use client";

import { forwardRef, type ChangeEvent, type ComponentProps } from "react";

import { Input } from "@tour/ui";

import { normalizeNumericInput, toPersianDigits } from "@/lib/digit-localization";
import { toEnglishDecimalString } from "../../lib/number-utils";

export type PersianNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "onChange" | "value" | "type"
> & {
  /** Stored / submitted value: English digits only (and one `.` when `numericMode="decimal"`). */
  value?: string | number;
  /** Always receives an English-normalized numeric string (ASCII digits; see module comment). */
  onChange?: (value: string) => void;
  /** `integer`: {@link normalizeNumericInput} then digits-only; `decimal`: {@link toEnglishDecimalString}. */
  numericMode?: "integer" | "decimal";
};

function englishFormValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    return String(value);
  }
  return String(value);
}

/**
 * Numeric field: the visible value uses Persian digits. On typing/paste, input is normalized to ASCII digits
 * via `digit-localization`, then integer/decimal rules apply. **`onChange` always receives English digits
 * only** (and at most one `.` in decimal mode), regardless of what script the user typed.
 */
export const PersianNumberInput = forwardRef<HTMLInputElement, PersianNumberInputProps>(
  function PersianNumberInput(
    {
      value,
      onChange,
      numericMode = "integer",
      inputMode,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const english = englishFormValue(value);
    const displayValue = english === "" ? "" : toPersianDigits(english);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const nextEnglish =
        numericMode === "decimal"
          ? toEnglishDecimalString(raw)
          : normalizeNumericInput(raw).replace(/\D/g, "");
      // onChange always receives English digits, regardless of what the user typed.
      onChange?.(nextEnglish);
    };

    return (
      <Input
        ref={ref}
        type="text"
        dir="ltr"
        inputMode={inputMode ?? (numericMode === "decimal" ? "decimal" : "numeric")}
        {...rest}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
      />
    );
  },
);
