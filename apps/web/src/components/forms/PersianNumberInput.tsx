"use client";

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type MutableRefObject,
} from "react";

import { Input } from "@tour/ui";

import { normalizeNumericInput, toPersianDigits } from "@/lib/digit-localization";
import {
  formatEnglishWithThousands,
  stripNumericSeparators,
  toEnglishDecimalString,
} from "../../lib/number-utils";

const DISPLAY_DIGIT_CHAR = /[\d\u06f0-\u06f9\u0660-\u0669]/;

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
  /**
   * Shows thousands separators (e.g. ۱٬۲۰۰٬۰۰۰); strips them on edit. Stored value stays plain ASCII digits.
   */
  formatThousands?: boolean;
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

function digitsBeforeCaret(s: string, caretPos: number): number {
  const end = Math.min(Math.max(caretPos, 0), s.length);
  let n = 0;
  for (let i = 0; i < end; i++) {
    const ch = s[i];
    if (ch && DISPLAY_DIGIT_CHAR.test(ch)) {
      n += 1;
    }
  }
  return n;
}

function caretFromDigitsBefore(display: string, digitsBeforeDesired: number): number {
  if (digitsBeforeDesired <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < display.length; i++) {
    const ch = display[i];
    if (ch && DISPLAY_DIGIT_CHAR.test(ch)) {
      seen += 1;
      if (seen >= digitsBeforeDesired) {
        return i + 1;
      }
    }
  }
  return display.length;
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
      formatThousands = false,
      inputMode,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const caretDigitCountRef = useRef<number | null>(null);

    const english = englishFormValue(value);
    const asciiGrouped =
      formatThousands && english !== "" ? formatEnglishWithThousands(english, numericMode) : english;

    const displayValue =
      asciiGrouped === ""
        ? ""
        : (() => {
            const localized = asciiGrouped.includes(",") ? asciiGrouped.replace(/,/g, "٬") : asciiGrouped;
            return toPersianDigits(localized);
          })();

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.target;

      const raw = el.value;

      let nextEnglish: string;
      if (formatThousands) {
        const normalized = normalizeNumericInput(raw);
        const cleaned = stripNumericSeparators(normalized);
        caretDigitCountRef.current = digitsBeforeCaret(raw, el.selectionStart ?? 0);
        nextEnglish =
          numericMode === "decimal" ? toEnglishDecimalString(cleaned) : cleaned.replace(/\D/g, "");
      } else {
        nextEnglish =
          numericMode === "decimal"
            ? toEnglishDecimalString(raw)
            : normalizeNumericInput(raw).replace(/\D/g, "");
      }

      // onChange always receives English digits, regardless of what the user typed.
      onChange?.(nextEnglish);
    };

    useLayoutEffect(() => {
      if (!formatThousands || caretDigitCountRef.current == null) {
        return;
      }
      const el = innerRef.current;
      if (!el || document.activeElement !== el) {
        caretDigitCountRef.current = null;
        return;
      }
      const pos = caretFromDigitsBefore(displayValue, caretDigitCountRef.current);
      el.setSelectionRange(pos, pos);
      caretDigitCountRef.current = null;
    }, [displayValue, formatThousands]);

    const mergedRef = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref != null) {
        (ref as MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    return (
      <Input
        ref={mergedRef}
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
