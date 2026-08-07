"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  applyBookingsDepartureWindowChip,
  BOOKINGS_DEPARTURE_WINDOW_DAYS,
  isBookingsDepartureWindowChipActive,
  type BookingsDepartureWindowDays,
} from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-types";

type BookingsUpcomingFacetButtonProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
};

const WINDOW_I18N_KEY: Record<BookingsDepartureWindowDays, "days7" | "days14" | "days30"> = {
  7: "days7",
  14: "days14",
  30: "days30",
};

/** UX-BKG-45 / UX-BKG-51 — Departure window 7/14/30 chips (primary L2 control). */
export function BookingsUpcomingFacetButton({
  query,
  onReplaceQuery,
}: BookingsUpcomingFacetButtonProps) {
  const t = useTranslations("bookings");

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.upcomingFacet}
      role="group"
      aria-label={t("upcomingWindow")}
    >
      <span className="me-1 text-xs text-muted-foreground">{t("upcomingWindow")}</span>
      {BOOKINGS_DEPARTURE_WINDOW_DAYS.map((days) => {
        const active = isBookingsDepartureWindowChipActive(query, days);
        return (
          <Button
            key={days}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.upcomingFacetDay(days)}
            aria-pressed={active}
            onClick={() => onReplaceQuery(applyBookingsDepartureWindowChip(query, days))}
          >
            {t(WINDOW_I18N_KEY[days])}
          </Button>
        );
      })}
    </div>
  );
}
