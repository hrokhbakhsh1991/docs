"use client";

import { Button, Input } from "../../adapters/platform-primitives";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

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
  const [hourDraft, setHourDraft] = useState(selectedHour);
  const [minuteDraft, setMinuteDraft] = useState(selectedMinute);

  useEffect(() => {
    setHourDraft(selectedHour);
    setMinuteDraft(selectedMinute);
    const scrollSelected = (container: HTMLDivElement | null, selected: string) => {
      const option = container?.querySelector(`[data-time-option="${selected}"]`);
      option?.scrollIntoView({ block: "center" });
    };
    scrollSelected(hoursRef.current, selectedHour);
    scrollSelected(minutesRef.current, selectedMinute);
  }, [selectedHour, selectedMinute]);

  const selectHour = (hour: string) => {
    setHourDraft(hour);
    onChange(joinClockParts(hour, selectedMinute));
  };

  const selectMinute = (minute: string) => {
    setMinuteDraft(minute);
    onChange(joinClockParts(selectedHour, minute));
  };

  const commitTypedPart = (part: "hour" | "minute", rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 2);
    if (part === "hour") {
      setHourDraft(digits);
    } else {
      setMinuteDraft(digits);
    }
    if (digits.length !== 2) {
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    const max = part === "hour" ? 23 : 59;
    if (parsed > max) {
      return;
    }
    onChange(
      joinClockParts(
        part === "hour" ? digits : selectedHour,
        part === "minute" ? digits : selectedMinute
      )
    );
  };

  const quickMinutes = ["00", "15", "30", "45"];

  return (
    <div
      className={cn("operator-time-picker", className)}
      data-operator-wizard-time-picker
      dir="ltr"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="operator-time-picker__header">
        <div>
          <p className="operator-time-picker__eyebrow">{t("timeLabel")}</p>
          <p className="operator-time-picker__hint">{t("timePickerHint")}</p>
        </div>
        <p className="operator-time-picker__preview" aria-live="polite">
          {formatOptionLabel(joinClockParts(selectedHour, selectedMinute), locale)}
        </p>
      </div>
      <div className="operator-time-picker__digital" aria-label={t("timeLabel")}>
        <label className="operator-time-picker__digital-field">
          <span>{t("hour")}</span>
          <Input
            inputMode="numeric"
            maxLength={2}
            value={hourDraft}
            aria-label={t("hour")}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => commitTypedPart("hour", event.currentTarget.value)}
          />
        </label>
        <span className="operator-time-picker__digital-separator" aria-hidden>
          :
        </span>
        <label className="operator-time-picker__digital-field">
          <span>{t("minute")}</span>
          <Input
            inputMode="numeric"
            maxLength={2}
            value={minuteDraft}
            aria-label={t("minute")}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => commitTypedPart("minute", event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="operator-time-picker__quick" aria-label={t("quickMinutes")}>
        <span className="operator-time-picker__column-label">{t("quickMinutes")}</span>
        <div className="operator-time-picker__quick-list">
          {quickMinutes.map((minute) => (
            <button
              key={minute}
              type="button"
              className={cn(
                "operator-time-picker__quick-option",
                minute === selectedMinute && "operator-time-picker__quick-option--selected"
              )}
              onClick={() => selectMinute(minute)}
            >
              {formatOptionLabel(minute, locale)}
            </button>
          ))}
        </div>
      </div>
      <div className="operator-time-picker__columns" role="group" aria-label={t("timeLabel")}>
        <div className="operator-time-picker__column-wrap">
          <span className="operator-time-picker__column-label">{t("hour")}</span>
          <div
            ref={hoursRef}
            className="operator-time-picker__column"
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
                    "operator-time-picker__option",
                    selected && "operator-time-picker__option--selected"
                  )}
                  onClick={() => selectHour(hour)}
                >
                  {formatOptionLabel(hour, locale)}
                </button>
              );
            })}
          </div>
        </div>
        <span className="operator-time-picker__separator" aria-hidden>
          :
        </span>
        <div className="operator-time-picker__column-wrap">
          <span className="operator-time-picker__column-label">{t("minute")}</span>
          <div
            ref={minutesRef}
            className="operator-time-picker__column"
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
                    "operator-time-picker__option",
                    selected && "operator-time-picker__option--selected"
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
      {onConfirm != null ? (
        <div className="operator-time-picker__actions">
          <Button
            type="button"
            variant="ghost"
            className="operator-time-picker__confirm"
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
