"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useLocale } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import {
  digitsFromOtpValue,
  normalizeOtpDigits,
  OTP_SEGMENT_LENGTH,
} from "@/features/auth/otp-segment-input.logic";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export { normalizeOtpDigits, OTP_SEGMENT_LENGTH } from "@/features/auth/otp-segment-input.logic";

type OtpSegmentInputProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly disabled?: boolean;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
};

function displayDigit(digit: string, locale: AppLocale): string {
  return digit.length > 0 ? toLocalizedDigits(digit, locale) : "";
}

export function OtpSegmentInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: OtpSegmentInputProps) {
  const locale = useLocale() as AppLocale;
  const labelId = useId();
  const autofillSinkId = useId();
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const valueRef = useRef(value);

  valueRef.current = value;
  const cells = digitsFromOtpValue(value);

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

  const focusCell = useCallback((index: number): void => {
    const clamped = Math.max(0, Math.min(OTP_SEGMENT_LENGTH - 1, index));
    const target = inputRefs.current[clamped];
    if (!target) {
      return;
    }
    target.focus({ preventScroll: true });
    target.select();
  }, []);

  const applyDigitsAtIndex = useCallback(
    (startIndex: number, raw: string): void => {
      const incoming = normalizeOtpDigits(raw);
      if (incoming.length === 0) {
        return;
      }
      const next = digitsFromOtpValue(valueRef.current);
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
    [emitValue, focusCell]
  );

  const commitDigitAtIndex = useCallback(
    (index: number, digit: string): void => {
      const next = digitsFromOtpValue(valueRef.current);
      next[index] = digit;
      emitValue(next);
      if (index < OTP_SEGMENT_LENGTH - 1) {
        focusCell(index + 1);
      }
    },
    [emitValue, focusCell]
  );

  useEffect(() => {
    if (disabled || value.length > 0) {
      return;
    }
    inputRefs.current[0]?.focus({ preventScroll: true });
  }, [disabled, value]);

  function handleCellChange(index: number, raw: string): void {
    const incoming = normalizeOtpDigits(raw);
    if (incoming.length === 0) {
      const next = digitsFromOtpValue(valueRef.current);
      next[index] = "";
      emitValue(next);
      return;
    }
    if (incoming.length > 1) {
      applyDigitsAtIndex(index, incoming);
      return;
    }
    commitDigitAtIndex(index, incoming);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    const current = digitsFromOtpValue(valueRef.current);

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const digit = normalizeOtpDigits(event.key);
      if (digit.length === 1) {
        event.preventDefault();
        commitDigitAtIndex(index, digit);
        return;
      }
    }

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
    <div
      data-otp-segment-input
      className="relative w-full max-w-full overflow-x-hidden"
      dir="ltr"
    >
      <Input
        id={autofillSinkId}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute start-0 top-0 h-px w-px opacity-0"
        value={value}
        onChange={(event) => handleAutofillSinkChange(event.target.value)}
      />
      <div
        className="mx-auto flex w-fit max-w-full justify-center gap-1.5 sm:gap-2"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={ariaDescribedBy}
      >
        <span id={labelId} className="sr-only">
          OTP
        </span>
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
            value={displayDigit(digit, locale)}
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-label={`Digit ${index + 1}`}
            data-otp-cell={index}
            dir="ltr"
            className={cn(
              "box-border !w-10 !max-w-10 shrink-0 basis-10 !px-0 !py-0 text-center text-lg font-semibold tabular-nums shadow-sm sm:!w-11 sm:!max-w-11 sm:basis-11 sm:text-xl",
              "h-12 sm:h-14",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onChange={(event) => handleCellChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(event, index)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
