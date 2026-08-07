"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { toggleBookingsTourChipScopeAll } from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingsCommandCenterQuery,
} from "@/features/bookings/bookings-command-center-types";

type BookingsTourChipScopeToggleProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
};

/** UX-BKG-35 — Show all tours (history) vs ops-scoped summary chips. */
export function BookingsTourChipScopeToggle({
  query,
  onReplaceQuery,
}: BookingsTourChipScopeToggleProps) {
  const t = useTranslations("bookings");
  const active = query.tourChipScope === "all";

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.tourChipScopeAll}
      aria-pressed={active}
      onClick={() => onReplaceQuery(toggleBookingsTourChipScopeAll(query))}
    >
      {t("showAllTours")}
    </Button>
  );
}
