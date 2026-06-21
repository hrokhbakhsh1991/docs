"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  buildGregorianMonthGrid,
  buildPersianMonthGrid,
  formatCalendarDayLabel,
  formatCalendarMonthTitle,
  initialViewFromIso,
  shiftViewMonth,
  todayIsoDate,
  weekdayShortLabels,
  type CalendarDayCell,
} from "../../adapters/calendar-format";
import { type AppLocale } from "../../adapters/i18n-format";
import { Button } from "../../adapters/platform-primitives";
import { cn } from "../../utils/cn";

export type DenaliCalendarProps = {
  readonly value: string;
  readonly onSelect: (isoDate: string) => void;
  readonly className?: string;
};

function ChevronLeftIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function buildMonthGrid(
  viewYear: number,
  viewMonth: number,
  selectedIso: string,
  todayIso: string,
  locale: AppLocale
): CalendarDayCell[] {
  return locale === "fa"
    ? buildPersianMonthGrid(viewYear, viewMonth, selectedIso, todayIso)
    : buildGregorianMonthGrid(viewYear, viewMonth, selectedIso, todayIso);
}

export function DenaliCalendar({ value, onSelect, className }: DenaliCalendarProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const todayIso = todayIsoDate();
  const initial = initialViewFromIso(value, locale);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, value, todayIso, locale),
    [locale, todayIso, value, viewMonth, viewYear]
  );
  const weekdays = weekdayShortLabels(locale);

  const goMonth = (delta: number) => {
    const next = shiftViewMonth(viewYear, viewMonth, delta, locale);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  return (
    <div
      className={cn("denali-wizard-calendar", className)}
      data-testid="localized-calendar"
      data-denali-wizard-calendar
    >
      <div className="denali-wizard-calendar__header">
        <Button
          type="button"
          variant="secondary"
          aria-label={t("previousMonth")}
          className="denali-wizard-calendar__nav"
          onClick={() => goMonth(-1)}
        >
          <ChevronLeftIcon className="denali-wizard-calendar__nav-icon rtl:rotate-180" />
        </Button>
        <p className="denali-wizard-calendar__title">
          {formatCalendarMonthTitle(viewYear, viewMonth, locale)}
        </p>
        <Button
          type="button"
          variant="secondary"
          aria-label={t("nextMonth")}
          className="denali-wizard-calendar__nav"
          onClick={() => goMonth(1)}
        >
          <ChevronRightIcon className="denali-wizard-calendar__nav-icon rtl:rotate-180" />
        </Button>
      </div>

      <div className="denali-wizard-calendar__weekdays">
        {weekdays.map((label: string) => (
          <span key={label} className="denali-wizard-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="denali-wizard-calendar__grid">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            data-testid={cell.isSelected ? "calendar-day-selected" : undefined}
            aria-label={cell.iso}
            aria-pressed={cell.isSelected}
            className={cn(
              "denali-wizard-calendar__day",
              !cell.inCurrentMonth && "denali-wizard-calendar__day--outside",
              cell.isToday && !cell.isSelected && "denali-wizard-calendar__day--today"
            )}
            onClick={() => onSelect(cell.iso)}
          >
            {formatCalendarDayLabel(cell.day, locale)}
          </button>
        ))}
      </div>

      <div className="denali-wizard-calendar__footer">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onSelect(todayIso);
            const nextView = initialViewFromIso(todayIso, locale);
            setViewYear(nextView.year);
            setViewMonth(nextView.month);
          }}
        >
          {t("today")}
        </Button>
      </div>
    </div>
  );
}
