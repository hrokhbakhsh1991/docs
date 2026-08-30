"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import {
  buildCalendarYearPage,
  buildGregorianMonthGrid,
  buildPersianMonthGrid,
  canShiftViewMonthBackward,
  formatCalendarDayLabel,
  formatCalendarMonthName,
  formatCalendarYearLabel,
  initialViewFromIso,
  isCalendarMonthBeforeMinIso,
  isCalendarYearBeforeMinIso,
  shiftCalendarYearPage,
  shiftViewMonth,
  todayIsoDate,
  weekdayShortLabels,
  type CalendarDayCell,
  type CalendarViewMode,
} from "./calendar-format";
import { isIsoDateSelectable } from "./calendar-date-policy";
import { type AppLocale } from "./i18n-format";
import { Button } from "@app-tour/ui-primitives/button";
import { cn } from "./cn";

export type SolarHijriCalendarProps = {
  readonly value: string;
  /** Gregorian civil ISO `YYYY-MM-DD`. */
  readonly onSelect: (isoDate: string) => void;
  readonly minIsoDate?: string;
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
  locale: AppLocale,
  minIsoDate?: string
): CalendarDayCell[] {
  return locale === "fa"
    ? buildPersianMonthGrid(viewYear, viewMonth, selectedIso, todayIso, minIsoDate)
    : buildGregorianMonthGrid(viewYear, viewMonth, selectedIso, todayIso, minIsoDate);
}

export function SolarHijriCalendar({
  value,
  onSelect,
  minIsoDate,
  className,
}: SolarHijriCalendarProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const todayIso = todayIsoDate();
  const initial = initialViewFromIso(value, locale);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("days");
  const [yearPageAnchor, setYearPageAnchor] = useState(initial.year);

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, value, todayIso, locale, minIsoDate),
    [locale, minIsoDate, todayIso, value, viewMonth, viewYear]
  );
  const weekdays = weekdayShortLabels(locale);
  const yearPage = useMemo(() => buildCalendarYearPage(yearPageAnchor), [yearPageAnchor]);
  const canGoPrev =
    viewMode === "days"
      ? canShiftViewMonthBackward(viewYear, viewMonth, locale, minIsoDate)
      : viewMode === "months"
        ? minIsoDate == null ||
          !isCalendarYearBeforeMinIso(viewYear - 1, locale, minIsoDate)
        : minIsoDate == null ||
          !isCalendarYearBeforeMinIso(
            Math.floor(yearPageAnchor / 12) * 12 - 1,
            locale,
            minIsoDate
          );

  const goMonth = (delta: number) => {
    if (viewMode === "years") {
      setYearPageAnchor((current) => shiftCalendarYearPage(current, delta));
      return;
    }
    if (viewMode === "months") {
      setViewYear((current) => current + delta);
      return;
    }
    const next = shiftViewMonth(viewYear, viewMonth, delta, locale);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const selectDay = (iso: string) => {
    if (!isIsoDateSelectable(iso, minIsoDate)) {
      return;
    }
    onSelect(iso);
  };

  const selectMonth = (month: number) => {
    if (
      minIsoDate != null &&
      isCalendarMonthBeforeMinIso(viewYear, month, locale, minIsoDate)
    ) {
      return;
    }
    setViewMonth(month);
    setViewMode("days");
  };

  const selectYear = (year: number) => {
    if (minIsoDate != null && isCalendarYearBeforeMinIso(year, locale, minIsoDate)) {
      return;
    }
    setViewYear(year);
    setYearPageAnchor(year);
    setViewMode("months");
  };

  const headerTitle =
    viewMode === "years" ? (
      <p className="operator-wizard-calendar__title operator-wizard-calendar__title--range">
        {formatCalendarYearLabel(yearPage[0]!, locale)} –{" "}
        {formatCalendarYearLabel(yearPage[yearPage.length - 1]!, locale)}
      </p>
    ) : viewMode === "months" ? (
      <button
        type="button"
        className="operator-wizard-calendar__title-btn operator-wizard-calendar__title-btn--solo"
        aria-label={t("pickYear")}
        onClick={(event) => {
          event.stopPropagation();
          setYearPageAnchor(viewYear);
          setViewMode("years");
        }}
      >
        {formatCalendarYearLabel(viewYear, locale)}
      </button>
    ) : (
      <div className="operator-wizard-calendar__title-group">
        <button
          type="button"
          className="operator-wizard-calendar__title-btn"
          aria-label={t("pickMonth")}
          onClick={(event) => {
            event.stopPropagation();
            setViewMode("months");
          }}
        >
          {formatCalendarMonthName(viewMonth, locale)}
        </button>
        <button
          type="button"
          className="operator-wizard-calendar__title-btn"
          aria-label={t("pickYear")}
          onClick={(event) => {
            event.stopPropagation();
            setYearPageAnchor(viewYear);
            setViewMode("years");
          }}
        >
          {formatCalendarYearLabel(viewYear, locale)}
        </button>
      </div>
    );

  const stopPickerEvent = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  return (
    <div
      className={cn("operator-wizard-calendar", className)}
      data-testid="localized-calendar"
      data-operator-wizard-calendar
      data-operator-wizard-calendar-view={viewMode}
      onPointerDown={stopPickerEvent}
      onMouseDown={stopPickerEvent}
      onClick={stopPickerEvent}
    >
      <div className="operator-wizard-calendar__header">
        <Button
          type="button"
          variant="ghost"
          aria-label={viewMode === "years" ? t("previousYears") : t("previousMonth")}
          className="operator-wizard-calendar__nav"
          disabled={!canGoPrev}
          onClick={() => goMonth(-1)}
        >
          <ChevronLeftIcon className="operator-wizard-calendar__nav-icon" />
        </Button>
        {headerTitle}
        <Button
          type="button"
          variant="ghost"
          aria-label={viewMode === "years" ? t("nextYears") : t("nextMonth")}
          className="operator-wizard-calendar__nav"
          onClick={() => goMonth(1)}
        >
          <ChevronRightIcon className="operator-wizard-calendar__nav-icon" />
        </Button>
      </div>

      {viewMode === "days" ? (
        <>
          <div className="operator-wizard-calendar__weekdays">
            {weekdays.map((label: string) => (
              <span key={label} className="operator-wizard-calendar__weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="operator-wizard-calendar__grid">
            {cells.map((cell) => (
              <button
                key={cell.iso}
                type="button"
                data-testid={cell.isSelected ? "calendar-day-selected" : undefined}
                aria-label={cell.iso}
                aria-pressed={cell.isSelected}
                aria-current={cell.isToday && !cell.isSelected ? "date" : undefined}
                disabled={cell.isDisabled}
                className={cn(
                  "operator-wizard-calendar__day",
                  !cell.inCurrentMonth && "operator-wizard-calendar__day--outside",
                  cell.isToday && "operator-wizard-calendar__day--today",
                  cell.isDisabled && "operator-wizard-calendar__day--disabled"
                )}
                onClick={() => selectDay(cell.iso)}
              >
                {formatCalendarDayLabel(cell.day, locale)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="operator-wizard-calendar__picker-grid">
          {viewMode === "months"
            ? Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                const disabled =
                  minIsoDate != null &&
                  isCalendarMonthBeforeMinIso(viewYear, month, locale, minIsoDate);
                const selected = month === viewMonth;
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    className={cn(
                      "operator-wizard-calendar__picker-cell",
                      selected && "operator-wizard-calendar__picker-cell--selected",
                      disabled && "operator-wizard-calendar__picker-cell--disabled"
                    )}
                    onClick={() => selectMonth(month)}
                  >
                    {formatCalendarMonthName(month, locale)}
                  </button>
                );
              })
            : yearPage.map((year) => {
                const disabled =
                  minIsoDate != null && isCalendarYearBeforeMinIso(year, locale, minIsoDate);
                const selected = year === viewYear;
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    className={cn(
                      "operator-wizard-calendar__picker-cell",
                      selected && "operator-wizard-calendar__picker-cell--selected",
                      disabled && "operator-wizard-calendar__picker-cell--disabled"
                    )}
                    onClick={() => selectYear(year)}
                  >
                    {formatCalendarYearLabel(year, locale)}
                  </button>
                );
              })}
        </div>
      )}

      {viewMode === "days" ? (
        <div className="operator-wizard-calendar__footer">
          <Button
            type="button"
            variant="ghost"
            disabled={!isIsoDateSelectable(todayIso, minIsoDate)}
            onClick={() => {
              selectDay(todayIso);
              const nextView = initialViewFromIso(todayIso, locale);
              setViewYear(nextView.year);
              setViewMonth(nextView.month);
            }}
          >
            {t("today")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
