"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  isDatetimePickerDateUnchanged,
  joinDatetimeLocal,
  resolveDatetimePickerTimeForDateCommit,
  splitDatetimeLocal,
} from "../adapters/datetime-format";
import { type AppLocale } from "../adapters/i18n-format";
import { cn } from "../utils/cn";
import { DenaliTimeInput } from "./denali-time-input";
import { LocalizedDatePicker } from "./localized-date-picker";

export type DenaliWizardDatetimePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (datetimeLocal: string) => void;
  /** Used when the control has a date but no clock yet (e.g. end inherits start). */
  readonly fallbackTime?: string;
  readonly minIsoDate?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly className?: string;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Persian/Gregorian date + HH:mm — wizard layout: one shared control bar. */
export function DenaliWizardDatetimePicker({
  id,
  value,
  onChange,
  fallbackTime,
  minIsoDate,
  disabled = false,
  required = false,
  invalid = false,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: DenaliWizardDatetimePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const { date, time } = splitDatetimeLocal(value);

  return (
    <div
      className={cn("operator-wizard-datetime", className)}
      data-operator-wizard-datetime
      data-testid={dataTestId}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <div className="operator-wizard-datetime__control">
        <div className="operator-wizard-datetime__date">
          <LocalizedDatePicker
            id={id}
            value={date}
            minIsoDate={minIsoDate}
            disabled={disabled}
            required={required}
            invalid={invalid}
            aria-label={ariaLabel ?? t("pickDate")}
            className="operator-wizard-datetime__date-trigger"
            onChange={(nextDate) => {
              if (isDatetimePickerDateUnchanged(nextDate, date)) {
                return;
              }
              onChange(
                joinDatetimeLocal(
                  nextDate,
                  resolveDatetimePickerTimeForDateCommit(time, fallbackTime)
                )
              );
            }}
          />
        </div>
        <div className="operator-wizard-datetime__divider" aria-hidden />
        <DenaliTimeInput
          appearance="inline"
          value={time}
          disabled={disabled}
          required={required}
          invalid={invalid}
          aria-label={t("timeLabel")}
          onChange={(nextTime) => onChange(joinDatetimeLocal(date, nextTime))}
        />
      </div>
    </div>
  );
}

/** @deprecated Use {@link DenaliWizardDatetimePicker}; alias for wizard bridge compatibility. */
export const LocalizedDatetimePicker = DenaliWizardDatetimePicker;

export type LocalizedDatetimePickerProps = DenaliWizardDatetimePickerProps;
