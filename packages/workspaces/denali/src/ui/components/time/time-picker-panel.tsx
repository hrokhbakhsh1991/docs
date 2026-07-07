"use client";

import { Button } from "../../adapters/platform-primitives";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { toLocalizedDigits, type AppLocale } from "../../adapters/i18n-format";
import { cn } from "../../utils/cn";
import {
  joinClockParts,
  listTimePickerHours,
  listTimePickerMinutes,
  splitClockValue,
} from "./time-picker-logic";

export type TimePickerPanelProps = {
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly onConfirm?: () => void;
  readonly className?: string;
};

function formatOptionLabel(value: string, locale: AppLocale): string {
  return locale === "fa" ? toLocalizedDigits(value, locale) : value;
}

export function TimePickerPanel({ value, onChange, onConfirm, className }: TimePickerPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const { hours, minutes } = splitClockValue(value);
  const hourOptions = listTimePickerHours();
  const minuteOptions = listTimePickerMinutes();
  const selectedHour = hours.length > 0 ? hours : "09";
  const selectedMinute = minutes.length > 0 ? minutes : "00";

  useEffect(() => {
    const scrollSelected = (container: HTMLDivElement | null, selected: string) => {
      const option = container?.querySelector(`[data-time-option="${selected}"]`);
      option?.scrollIntoView({ block: "center" });
    };
    scrollSelected(hoursRef.current, selectedHour);
    scrollSelected(minutesRef.current, selectedMinute);
  }, [selectedHour, selectedMinute]);

  const selectHour = (hour: string) => {
    onChange(joinClockParts(hour, selectedMinute));
  };

  const selectMinute = (minute: string) => {
    onChange(joinClockParts(selectedHour, minute));
  };

  return (
    <div
      className={cn("denali-time-picker", className)}
      data-denali-wizard-time-picker
      dir="ltr"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <p className="denali-time-picker__hint">{t("timePickerHint")}</p>
      <div className="denali-time-picker__columns" role="group" aria-label={t("timeLabel")}>
        <div className="denali-time-picker__column-wrap">
          <span className="denali-time-picker__column-label">{t("hour")}</span>
          <div
            ref={hoursRef}
            className="denali-time-picker__column"
            role="listbox"
            aria-label={t("hour")}
            tabIndex={0}
          >
            {hourOptions.map((hour) => {
              const selected = hour === selectedHour;
              return (
                <button
                  key={hour}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-time-option={hour}
                  className={cn(
                    "denali-time-picker__option",
                    selected && "denali-time-picker__option--selected"
                  )}
                  onClick={() => selectHour(hour)}
                >
                  {formatOptionLabel(hour, locale)}
                </button>
              );
            })}
          </div>
        </div>
        <span className="denali-time-picker__separator" aria-hidden>
          :
        </span>
        <div className="denali-time-picker__column-wrap">
          <span className="denali-time-picker__column-label">{t("minute")}</span>
          <div
            ref={minutesRef}
            className="denali-time-picker__column"
            role="listbox"
            aria-label={t("minute")}
            tabIndex={0}
          >
            {minuteOptions.map((minute) => {
              const selected = minute === selectedMinute;
              return (
                <button
                  key={minute}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-time-option={minute}
                  className={cn(
                    "denali-time-picker__option",
                    selected && "denali-time-picker__option--selected"
                  )}
                  onClick={() => selectMinute(minute)}
                >
                  {formatOptionLabel(minute, locale)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="denali-time-picker__preview" aria-live="polite">
        {formatOptionLabel(joinClockParts(selectedHour, selectedMinute), locale)}
      </p>
      {onConfirm != null ? (
        <div className="denali-time-picker__actions">
          <Button
            type="button"
            variant="ghost"
            className="denali-time-picker__confirm"
            onClick={(event) => {
              event.stopPropagation();
              onConfirm();
            }}
          >
            {t("confirmTime")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
