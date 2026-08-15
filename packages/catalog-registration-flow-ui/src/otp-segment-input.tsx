"use client";

import { Input } from "@app-tour/ui-primitives/input";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

type OtpSegmentInputProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly disabled?: boolean;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
};

const OTP_SEGMENT_LENGTH = 4;

function normalizeOtpDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_SEGMENT_LENGTH);
}

function digitsFromValue(value: string): string[] {
  const normalized = normalizeOtpDigits(value);
  return Array.from({ length: OTP_SEGMENT_LENGTH }, (_, index) => normalized[index] ?? "");
}

export function OtpSegmentInput({
  id,
  value,
  onChange,
  onComplete,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: OtpSegmentInputProps) {
  const labelId = useId();
  const autofillSinkId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const valueRef = useRef(value);

  valueRef.current = value;
  const cells = digitsFromValue(value);

  const emitValue = useCallback(
    (nextDigits: string[]) => {
      const next = nextDigits.join("").slice(0, OTP_SEGMENT_LENGTH);
      valueRef.current = next;
      onChange(next);
      if (next.length === OTP_SEGMENT_LENGTH) {
        onComplete?.(next);
      }
    },
    [onChange, onComplete]
  );

  const applyDigitsAtIndex = useCallback(
    (startIndex: number, raw: string): void => {
      const incoming = normalizeOtpDigits(raw);
      if (incoming.length === 0) {
        return;
      }
      const next = digitsFromValue(valueRef.current);
      let writeIndex = startIndex;
      for (const digit of incoming) {
        if (writeIndex >= OTP_SEGMENT_LENGTH) {
          break;
        }
        next[writeIndex] = digit;
        writeIndex += 1;
      }
      emitValue(next);
      focusCell(Math.min(writeIndex, OTP_SEGMENT_LENGTH - 1));
    },
    [emitValue]
  );

  useEffect(() => {
    if (disabled || value.length > 0) {
      return;
    }
    inputRefs.current[0]?.focus({ preventScroll: true });
  }, [disabled, value]);

  function focusCell(index: number): void {
    const clamped = Math.max(0, Math.min(OTP_SEGMENT_LENGTH - 1, index));
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
    const incoming = normalizeOtpDigits(raw);
    if (incoming.length === 0) {
      const next = digitsFromValue(valueRef.current);
      next[index] = "";
      emitValue(next);
      return;
    }
    if (incoming.length > 1) {
      applyDigitsAtIndex(index, incoming);
      return;
    }
    const next = digitsFromValue(valueRef.current);
    next[index] = incoming;
    emitValue(next);
    if (index < OTP_SEGMENT_LENGTH - 1) {
      focusCell(index + 1);
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    const current = digitsFromValue(valueRef.current);

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

    if (event.key === "ArrowRight" && index < OTP_SEGMENT_LENGTH - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, startIndex: number): void {
    event.preventDefault();
    applyDigitsAtIndex(startIndex, event.clipboardData.getData("text"));
  }

  function handleAutofillSinkChange(raw: string): void {
    applyDigitsAtIndex(0, raw);
  }

  return (
    <div data-otp-segment-input dir="ltr">
      <Input
        id={id ?? autofillSinkId}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
        value={value}
        onChange={(event) => handleAutofillSinkChange(event.target.value)}
      />
      <div role="group" aria-labelledby={labelId} aria-describedby={ariaDescribedBy}>
        <span id={labelId} className="sr-only">
          OTP
        </span>
        <div data-otp-segment-cells>
          {cells.map((digit, index) => (
            <Input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={1}
              value={digit}
              disabled={disabled}
              aria-invalid={ariaInvalid}
              aria-label={`Digit ${index + 1}`}
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
