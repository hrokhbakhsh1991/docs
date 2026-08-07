"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";

import {
  BOOKINGS_TOUR_CHIP_VISIBLE_MAX,
  ensureActiveTourChipPresent,
  partitionBookingTourChips,
  resolveActiveTourChipFallbackTitle,
  truncateTourChipTitle,
} from "./bookings-tour-chip-bar-logic";
import type { BookingListItem, BookingTourChip } from "./bookings-command-center-types";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "./bookings-command-center-types";
import { isTourChipActive } from "./bookings-command-center-logic";
import type { BookingsCommandCenterQuery } from "./bookings-command-center-types";

type BookingsTourChipBarProps = {
  readonly chips: readonly BookingTourChip[];
  readonly query: BookingsCommandCenterQuery;
  readonly listItems: readonly BookingListItem[];
  readonly locale: AppLocale;
  readonly onAllTours: () => void;
  readonly onSelectTour: (tourId: string) => void;
};

export function BookingsTourChipBar({
  chips,
  query,
  listItems,
  locale,
  onAllTours,
  onSelectTour,
}: BookingsTourChipBarProps) {
  const t = useTranslations("bookings");
  const withActive = ensureActiveTourChipPresent(
    chips,
    query.tourId.length > 0
      ? {
          tourId: query.tourId,
          tourTitle: resolveActiveTourChipFallbackTitle(listItems, query.tourId),
        }
      : null
  );
  const { visible, overflow } = partitionBookingTourChips(withActive, {
    activeTourId: query.tourId,
    maxVisible: BOOKINGS_TOUR_CHIP_VISIBLE_MAX,
  });

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChips}
    >
      <Button
        size="sm"
        variant={query.tourId.length === 0 ? "default" : "outline"}
        onClick={onAllTours}
      >
        {t("allTours")}
      </Button>
      {visible.map((chip) => {
        const label = truncateTourChipTitle(chip.tourTitle);
        return (
          <Button
            key={chip.tourId}
            size="sm"
            variant={isTourChipActive(query, chip.tourId) ? "default" : "outline"}
            title={chip.tourTitle}
            onClick={() => onSelectTour(chip.tourId)}
          >
            {label}{" "}
            ({formatLocalizedNumber(chip.pendingCount, locale)}/
            {formatLocalizedNumber(chip.totalCount, locale)})
          </Button>
        );
      })}
      {overflow.length > 0 ? (
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">{t("moreTours")}</span>
          <select
            className="h-8 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChipsMore}
            value={
              overflow.some((chip) => chip.tourId === query.tourId) ? query.tourId : ""
            }
            onChange={(event) => {
              const next = event.target.value.trim();
              if (next.length === 0) {
                return;
              }
              onSelectTour(next);
            }}
            aria-label={t("moreTours")}
          >
            <option value="">{t("moreTours")}</option>
            {overflow.map((chip) => (
              <option key={chip.tourId} value={chip.tourId}>
                {chip.tourTitle} ({chip.pendingCount}/{chip.totalCount})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
