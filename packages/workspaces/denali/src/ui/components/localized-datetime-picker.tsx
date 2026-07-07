"use client";

import { useLocale, useTranslations } from "next-intl";

import { joinDatetimeLocal, splitDatetimeLocal } from "../adapters/datetime-format";
import { type AppLocale } from "../adapters/i18n-format";
import { cn } from "../utils/cn";
import { DenaliTimeInput } from "./denali-time-input";
import { LocalizedDatePicker } from "./localized-date-picker";

export type DenaliWizardDatetimePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (datetimeLocal: string) => void;
  readonly minIsoDate?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Persian/Gregorian date + HH:mm — wizard layout: one shared control bar. */
export function DenaliWizardDatetimePicker({
  id,
  value,
  onChange,
  minIsoDate,
  disabled = false,
  required = false,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: DenaliWizardDatetimePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const { date, time } = splitDatetimeLocal(value);

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
            minIsoDate={minIsoDate}
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

/** @deprecated Use {@link DenaliWizardDatetimePicker}; alias for wizard bridge compatibility. */
export const LocalizedDatetimePicker = DenaliWizardDatetimePicker;

export type LocalizedDatetimePickerProps = DenaliWizardDatetimePickerProps;
