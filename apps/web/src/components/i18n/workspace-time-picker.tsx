"use client";

import { Input as PrimitiveInput } from "@app-tour/ui-primitives/input";
import { Clock3Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useRef, type KeyboardEventHandler, type RefObject } from "react";

import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { useLocalizedNumericInput } from "@/i18n/use-localized-numeric-input";
import { cn } from "@/lib/utils";

import {
  buildClockTime,
  normalizeClockSegmentsOnBlur,
  parseClockSegments,
} from "./workspace-time-picker-utils";

export type WorkspaceTimePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly "aria-label"?: string;
};

type ClockSegmentInputProps = {
  readonly segment: "hours" | "minutes";
  readonly value: string;
  readonly disabled: boolean;
  readonly ariaLabel: string;
  readonly placeholder: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onSegmentChange: (segment: "hours" | "minutes", next: string) => void;
  readonly onSegmentBlur: () => void;
  readonly onSegmentKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

function ClockSegmentInput({
  segment,
  value,
  disabled,
  ariaLabel,
  placeholder,
  inputRef,
  onSegmentChange,
  onSegmentBlur,
  onSegmentKeyDown,
}: ClockSegmentInputProps) {
  const localized = useLocalizedNumericInput({
    value,
    onChange: (next) => onSegmentChange(segment, next),
    mode: "digits",
    maxLength: 2,
  });

  return (
    <PrimitiveInput
      ref={inputRef}
      {...localized}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={cn("operator-wizard-time-picker__segment", localized.className)}
      onFocus={(event) => event.target.select()}
      onBlur={onSegmentBlur}
      onKeyDown={onSegmentKeyDown}
    />
  );
}

/** Operator wizard clock input — segmented HH:mm with Persian digits and theme-aligned chrome. */
export function WorkspaceTimePicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  "aria-label": ariaLabel,
}: WorkspaceTimePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const segments = parseClockSegments(value);
  const placeholder = toLocalizedDigits("00", locale);

  const emit = useCallback(
    (hours: string, minutes: string) => {
      onChange(buildClockTime(hours, minutes));
    },
    [onChange]
  );

  const handleSegmentChange = useCallback(
    (segment: "hours" | "minutes", next: string) => {
      if (segment === "hours") {
        emit(next, segments.minutes);
        if (next.length >= 2) {
          minutesRef.current?.focus();
        }
        return;
      }
      emit(segments.hours, next);
    },
    [emit, segments.hours, segments.minutes]
  );

  const handleBlur = useCallback(() => {
    const normalized = normalizeClockSegmentsOnBlur(segments);
    const next = buildClockTime(normalized.hours, normalized.minutes);
    if (next !== value) {
      onChange(next);
    }
  }, [onChange, segments, value]);

  const handleHoursKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
    if (event.key === "ArrowRight" || event.key === ":") {
      event.preventDefault();
      minutesRef.current?.focus();
    }
  }, []);

  const handleMinutesKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      hoursRef.current?.focus();
      return;
    }
    if (event.key === "Backspace" && segments.minutes.length === 0) {
      event.preventDefault();
      hoursRef.current?.focus();
    }
  }, [segments.minutes.length]);

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel ?? t("timeLabel")}
      aria-required={required || undefined}
      data-operator-wizard-time-picker
      aria-disabled={disabled || undefined}
      className={cn("operator-wizard-time-picker", className)}
    >
      <Clock3Icon className="operator-wizard-time-picker__icon" aria-hidden />
      <div className="operator-wizard-time-picker__segments">
        <ClockSegmentInput
          segment="hours"
          value={segments.hours}
          disabled={disabled}
          ariaLabel={t("hour")}
          placeholder={placeholder}
          inputRef={hoursRef}
          onSegmentChange={handleSegmentChange}
          onSegmentBlur={handleBlur}
          onSegmentKeyDown={handleHoursKeyDown}
        />
        <span className="operator-wizard-time-picker__separator" aria-hidden>
          :
        </span>
        <ClockSegmentInput
          segment="minutes"
          value={segments.minutes}
          disabled={disabled}
          ariaLabel={t("minute")}
          placeholder={placeholder}
          inputRef={minutesRef}
          onSegmentChange={handleSegmentChange}
          onSegmentBlur={handleBlur}
          onSegmentKeyDown={handleMinutesKeyDown}
        />
      </div>
    </div>
  );
}
