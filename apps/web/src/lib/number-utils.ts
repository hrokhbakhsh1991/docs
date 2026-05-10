import type { ChangeEvent, MutableRefObject, Ref, RefCallback, RefObject } from "react";

import { normalizeNumericInput, toEnglishDigits, toPersianDigits } from "@/lib/digit-localization";

/**
 * String normalization and react-hook-form wiring for numeric inputs.
 *
 * **Digit conversion** (Persian / Arabic-Indic ↔ ASCII) is defined only in
 * `@repo/digit-localization`. This module must not reimplement that logic; it only
 * composes {@link normalizeNumericInput}, {@link toEnglishDigits}, and {@link toPersianDigits}
 * with digit stripping, decimal rules, and UI sync helpers.
 */

/** Use on translated UI strings (placeholders, hints) so `0–9` show as Persian when `locale === "fa"`. */
export function uiLocaleDigits(text: string, locale: string): string {
  return locale === "fa" ? convertNumbers(text, "fa") : text;
}

/** Thin wrapper over {@link toEnglishDigits} / {@link toPersianDigits} for callers that choose direction via `"en"` | `"fa"`. */
export function convertNumbers(text: string, to: "fa" | "en"): string {
  if (!text) {
    return text;
  }
  return to === "en" ? toEnglishDigits(text) : toPersianDigits(text);
}

/** After script normalization via {@link normalizeNumericInput}, keep ASCII digits only (empty allowed). */
export function toEnglishIntegerString(value: string): string {
  return normalizeNumericInput(value).replace(/\D/g, "");
}

/** Commas / thin spaces / Arabic thousands separator ، (U+066C) typed or pasted — strip before numeric parse. */
export function stripNumericSeparators(value: string): string {
  return value.replace(/[,٬\s\u202f\u200c']/g, "");
}

/**
 * Group integer chunk with commas (ASCII) before Persian digit shaping; fractional part untouched.
 */
export function formatEnglishWithThousands(english: string, mode: "integer" | "decimal"): string {
  const safe = english.trim();
  if (safe === "") {
    return "";
  }

  if (mode === "integer") {
    const digitsOnly = safe.replace(/\D/g, "");
    if (digitsOnly === "") {
      return "";
    }
    return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const dotIdx = safe.indexOf(".");
  const intRaw = dotIdx === -1 ? safe : safe.slice(0, dotIdx);
  const fracRaw = dotIdx === -1 ? undefined : safe.slice(dotIdx + 1);

  const intDigits = intRaw.replace(/\D/g, "");
  const groupedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (dotIdx === -1) {
    return groupedInt;
  }

  return `${groupedInt}.${fracRaw ?? ""}`;
}

/** After script normalization, keep one optional decimal point and ASCII digits. */
export function toEnglishDecimalString(value: string): string {
  /** Arabic decimal separator `٫` (U+066B), common in Persian numeric typing. */
  const en = normalizeNumericInput(value).replace(/\u066b/g, ".");
  let out = "";
  let sawDot = false;
  for (const ch of en) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && !sawDot) {
      out += ch;
      sawDot = true;
    }
  }
  return out;
}

type InputRegisterLike = {
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: ChangeEvent<HTMLInputElement>) => void;
  name: string;
  ref: RefCallback<HTMLInputElement> | RefObject<HTMLInputElement | null>;
};

function assignRef<T>(ref: Ref<T> | undefined, instance: T | null): void {
  if (ref == null) {
    return;
  }
  if (typeof ref === "function") {
    (ref as RefCallback<T | null>)(instance);
  } else {
    (ref as MutableRefObject<T | null>).current = instance;
  }
}

/** Sync `<input>` display to Persian digits; keep `+` / separators outside digit runs unchanged. */
function syncIntegerInputPersianDisplay(el: HTMLInputElement): void {
  const en = toEnglishIntegerString(el.value);
  el.value = en === "" ? "" : toPersianDigits(en);
}

function syncDecimalInputPersianDisplay(el: HTMLInputElement): void {
  const en = toEnglishDecimalString(el.value);
  el.value = en === "" ? "" : toPersianDigits(en);
}

function composeInputRef(
  fieldRef: InputRegisterLike["ref"],
  syncDisplay: (el: HTMLInputElement) => void,
): RefCallback<HTMLInputElement> {
  return (instance) => {
    assignRef(fieldRef, instance);
    if (instance) {
      queueMicrotask(() => syncDisplay(instance));
    }
  };
}

/**
 * react-hook-form reads `event.target.name` / `.value` / `.type`.
 * Spreading a DOM `HTMLInputElement` into `{}` does not copy those fields, so the
 * form state can stay empty while the visible `<input>` shows Persian digits.
 */
export function syntheticChangeForInputValue(
  base: ChangeEvent<HTMLInputElement>,
  el: HTMLInputElement,
  valueForForm: string,
): ChangeEvent<HTMLInputElement> {
  const target = {
    name: el.name,
    value: valueForForm,
    type: el.type,
  } as unknown as EventTarget & HTMLInputElement;

  return {
    ...base,
    target,
    currentTarget: target,
  } as ChangeEvent<HTMLInputElement>;
}

/** Merge with `react-hook-form` `register()` for whole-number fields. */
export function withIntegerDigitNormalization<T extends InputRegisterLike>(field: T): T {
  return {
    ...field,
    ref: composeInputRef(field.ref, syncIntegerInputPersianDisplay),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const next = toEnglishIntegerString(el.value);
      el.value = next === "" ? "" : toPersianDigits(next);
      field.onChange(syntheticChangeForInputValue(e, el, next));
    },
    onBlur: (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const next = toEnglishIntegerString(el.value);
      el.value = next === "" ? "" : toPersianDigits(next);
      field.onBlur(syntheticChangeForInputValue(e, el, next));
    },
  };
}

/** Merge with `react-hook-form` `register()` for decimal fields (price). */
export function withDecimalDigitNormalization<T extends InputRegisterLike>(field: T): T {
  return {
    ...field,
    ref: composeInputRef(field.ref, syncDecimalInputPersianDisplay),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const next = toEnglishDecimalString(el.value);
      el.value = next === "" ? "" : toPersianDigits(next);
      field.onChange(syntheticChangeForInputValue(e, el, next));
    },
    onBlur: (e: ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const next = toEnglishDecimalString(el.value);
      el.value = next === "" ? "" : toPersianDigits(next);
      field.onBlur(syntheticChangeForInputValue(e, el, next));
    },
  };
}
