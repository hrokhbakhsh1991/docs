"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import {
  normalizeOtpDigits,
  digitsFromOtpValue as digitsFromValue,
  OTP_SEGMENT_LENGTH,
} from "@app-tour/ui-primitives/otp-segment-input-logic";

import { formatOtpDigitIndex } from "./format-otp-digit-index";

type OtpSegmentInputProps = {
  readonly id?: string;
  readonly value: string;
  readonly length?: 4 | 6;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly disabled?: boolean;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
};

/** Visually hide the group name; cells remain the only textboxes. */
const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function OtpSegmentInput({
  id,
  value,
  length = OTP_SEGMENT_LENGTH,
  onChange,
  onComplete,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: OtpSegmentInputProps) {
  const t = useTranslations("catalogRegistration");
  const locale = useLocale();
  const labelId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const valueRef = useRef(value);

  valueRef.current = value;
  const cells = digitsFromValue(value, length);

  const emitValue = useCallback(
    (nextDigits: string[]) => {
      const next = nextDigits.join("").slice(0, length);
      valueRef.current = next;
      onChange(next);
      if (next.length === length) {
        onComplete?.(next);
      }
    },
    [onChange, onComplete, length]
  );

  const applyDigitsAtIndex = useCallback(
    (startIndex: number, raw: string): void => {
      const incoming = normalizeOtpDigits(raw, length);
      if (incoming.length === 0) {
        return;
      }
      const next = digitsFromValue(valueRef.current, length);
      let writeIndex = startIndex;
      for (const digit of incoming) {
        if (writeIndex >= length) {
          break;
        }
        next[writeIndex] = digit;
        writeIndex += 1;
      }
      emitValue(next);
      focusCell(Math.min(writeIndex, length - 1));
    },
    [emitValue, length]
  );

  useEffect(() => {
    if (disabled || value.length > 0) {
      return;
    }
    inputRefs.current[0]?.focus({ preventScroll: true });
  }, [disabled, value]);

  function focusCell(index: number): void {
    const clamped = Math.max(0, Math.min(length - 1, index));
    const target = inputRefs.current[clamped];
    if (!target) {
      return;
    }
    requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.select();
    });
  }

  function handleCellChange(index: number, raw: string): void {
    const incoming = normalizeOtpDigits(raw, length);
    if (incoming.length === 0) {
      const next = digitsFromValue(valueRef.current, length);
      next[index] = "";
      emitValue(next);
      return;
    }
    if (incoming.length > 1) {
      applyDigitsAtIndex(index, incoming);
      return;
    }
    const next = digitsFromValue(valueRef.current, length);
    next[index] = incoming;
    emitValue(next);
    if (index < length - 1) {
      focusCell(index + 1);
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    const current = digitsFromValue(valueRef.current, length);

    if (event.key === "Backspace") {
      event.preventDefault();
      if (current[index] !== "") {
        const next = [...current];
        next[index] = "";
        emitValue(next);
        return;
      }
      if (index > 0) {
        const next = [...current];
        next[index - 1] = "";
        emitValue(next);
        focusCell(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusCell(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, startIndex: number): void {
    event.preventDefault();
    applyDigitsAtIndex(startIndex, event.clipboardData.getData("text"));
  }

  return (
    <div data-otp-segment-input dir="ltr" style={{ position: "relative" }}>
      <div id={id} role="group" aria-labelledby={labelId} aria-describedby={ariaDescribedBy}>
        <span id={labelId} style={visuallyHiddenStyle}>
          {t("otp.groupLabel")}
        </span>
        <div
          data-otp-segment-cells
          style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        >
          {cells.map((digit, index) => (
            <Input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              autoCorrect="off"
              spellCheck={false}
              maxLength={index === 0 ? length : 1}
              value={digit}
              disabled={disabled}
              aria-invalid={ariaInvalid}
              aria-label={t("otp.digitLabel", {
                index: formatOtpDigitIndex(index + 1, locale),
              })}
              data-otp-cell={index}
              dir="ltr"
              onChange={(event) => handleCellChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => handlePaste(event, index)}
              onFocus={(event) => event.target.select()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
