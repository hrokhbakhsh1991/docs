"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
} from "@/i18n/calendar-format";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { Button } from "./button";

export type CalendarProps = {
  readonly value: string;
  readonly onSelect: (isoDate: string) => void;
  readonly className?: string;
};

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

export function Calendar({ value, onSelect, className }: CalendarProps) {
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
      className={cn("w-[min(100vw-2rem,20rem)] p-3", className)}
      data-testid="localized-calendar"
      data-denali-wizard-calendar
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t("previousMonth")}
          onClick={() => goMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <p className="text-sm font-medium">{formatCalendarMonthTitle(viewYear, viewMonth, locale)}</p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t("nextMonth")}
          onClick={() => goMonth(1)}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdays.map((label) => (
          <span key={label} className="py-1 font-medium">
            {label}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            data-testid={cell.isSelected ? "calendar-day-selected" : undefined}
            aria-label={cell.iso}
            aria-pressed={cell.isSelected}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !cell.inCurrentMonth && "text-muted-foreground/60",
              cell.isToday && !cell.isSelected && "border border-primary/40 font-semibold",
              cell.isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={() => onSelect(cell.iso)}
          >
            {formatCalendarDayLabel(cell.day, locale)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-center border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
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
