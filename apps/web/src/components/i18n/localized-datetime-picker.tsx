"use client";

import { useLocale, useTranslations } from "next-intl";

import { joinDatetimeLocal, normalizeClockTime, splitDatetimeLocal } from "@/i18n/datetime-format";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { Label } from "../ui/label";
import { LocalizedDatePicker } from "./localized-date-picker";
import {
  LocalizedNumericInput,
  PrimitiveLocalizedNumericInput,
} from "./localized-numeric-input";

export type LocalizedTimeInputProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly variant?: "shadcn" | "primitive";
  readonly "aria-label"?: string;
};

/** HH:mm clock input with Persian digit display when locale is fa. */
export function LocalizedTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  variant = "shadcn",
  "aria-label": ariaLabel,
}: LocalizedTimeInputProps) {
  const t = useTranslations("common.calendar");
  const [hoursRaw = "", minutesRaw = ""] = value.split(":");

  const emit = (hours: string, minutes: string) => {
    if (hours.length === 0 && minutes.length === 0) {
      onChange("");
      return;
    }
    const hh = hours.padStart(2, "0").slice(-2);
    const mm = minutes.padStart(2, "0").slice(-2);
    onChange(normalizeClockTime(`${hh}:${mm}`));
  };

  const NumericInput = variant === "primitive" ? PrimitiveLocalizedNumericInput : LocalizedNumericInput;

  if (variant === "primitive") {
    return (
      <div
        id={id}
        role="group"
        aria-label={ariaLabel ?? t("timeLabel")}
        aria-required={required || undefined}
        className={cn("denali-wizard-datetime__clock", className)}
      >
        <NumericInput
          mode="digits"
          maxLength={2}
          value={hoursRaw}
          disabled={disabled}
          aria-label={t("hour")}
          className="denali-wizard-datetime__clock-digit"
          placeholder="00"
          onChange={(hours) => emit(hours, minutesRaw)}
        />
        <span className="denali-wizard-datetime__clock-separator" aria-hidden>
          :
        </span>
        <NumericInput
          mode="digits"
          maxLength={2}
          value={minutesRaw}
          disabled={disabled}
          aria-label={t("minute")}
          className="denali-wizard-datetime__clock-digit"
          placeholder="00"
          onChange={(minutes) => emit(hoursRaw, minutes)}
        />
      </div>
    );
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel ?? t("timeLabel")}
      aria-required={required || undefined}
      className={cn("flex items-center gap-1", className)}
    >
      <NumericInput
        mode="digits"
        maxLength={2}
        value={hoursRaw}
        disabled={disabled}
        aria-label={t("hour")}
        className="w-14 text-center"
        placeholder="00"
        onChange={(hours) => emit(hours, minutesRaw)}
      />
      <span className="text-muted-foreground" aria-hidden>
        :
      </span>
      <NumericInput
        mode="digits"
        maxLength={2}
        value={minutesRaw}
        disabled={disabled}
        aria-label={t("minute")}
        className="w-14 text-center"
        placeholder="00"
        onChange={(minutes) => emit(hoursRaw, minutes)}
      />
    </div>
  );
}

export type LocalizedDatetimePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (datetimeLocal: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly layout?: "default" | "wizard";
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Persian/Gregorian date picker plus localized HH:mm time inputs. Value: `YYYY-MM-DDTHH:mm`. */
export function LocalizedDatetimePicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  layout = "default",
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: LocalizedDatetimePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const { date, time } = splitDatetimeLocal(value);

  if (layout === "wizard") {
    return (
      <div
        className={cn("denali-wizard-datetime", className)}
        data-denali-wizard-datetime
        data-testid={dataTestId}
        dir={locale === "fa" ? "rtl" : "ltr"}
      >
        <div className="denali-wizard-datetime__date">
          <LocalizedDatePicker
            id={id}
            value={date}
            disabled={disabled}
            required={required}
            aria-label={ariaLabel ?? t("pickDate")}
            onChange={(nextDate) => onChange(joinDatetimeLocal(nextDate, time))}
          />
        </div>
        <div className="denali-wizard-datetime__time">
          <span className="denali-wizard-datetime__time-label">{t("timeLabel")}</span>
          <LocalizedTimeInput
            variant="primitive"
            value={time}
            disabled={disabled}
            required={required}
            onChange={(nextTime) => onChange(joinDatetimeLocal(date, nextTime))}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]", className)}
      data-testid={dataTestId}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <LocalizedDatePicker
        id={id}
        value={date}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? t("pickDate")}
        onChange={(nextDate) => onChange(joinDatetimeLocal(nextDate, time))}
      />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("timeLabel")}</Label>
        <LocalizedTimeInput
          value={time}
          disabled={disabled}
          required={required}
          onChange={(nextTime) => onChange(joinDatetimeLocal(date, nextTime))}
        />
      </div>
    </div>
  );
}
