"use client";

import { useLocale, useTranslations } from "next-intl";

import { joinDatetimeLocal, splitDatetimeLocal } from "@/i18n/datetime-format";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { DenaliTimeInput } from "./denali-time-input";
import { Label } from "../ui/label";
import { LocalizedDatePicker } from "./localized-date-picker";

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

/** HH:mm — Denali field style (wizard + settings). */
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
  if (variant === "primitive") {
    return (
      <DenaliTimeInput
        id={id}
        value={value}
        disabled={disabled}
        required={required}
        className={className}
        aria-label={ariaLabel}
        appearance="field"
        onChange={onChange}
      />
    );
  }

  return (
    <DenaliTimeInput
      id={id}
      value={value}
      disabled={disabled}
      required={required}
      className={className}
      aria-label={ariaLabel}
      appearance="field"
      onChange={onChange}
    />
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

/** Persian/Gregorian date + HH:mm. Wizard layout: one shared control bar. */
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
        <div className="denali-wizard-datetime__control">
          <div className="denali-wizard-datetime__date">
            <LocalizedDatePicker
              id={id}
              value={date}
              disabled={disabled}
              required={required}
              aria-label={ariaLabel ?? t("pickDate")}
              className="denali-wizard-datetime__date-trigger"
              onChange={(nextDate) => onChange(joinDatetimeLocal(nextDate, time))}
            />
          </div>
          <div className="denali-wizard-datetime__divider" aria-hidden />
          <DenaliTimeInput
            appearance="inline"
            value={time}
            disabled={disabled}
            required={required}
            aria-label={t("timeLabel")}
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
