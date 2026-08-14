"use client";

import { resolveBookingJourneyState } from "@app-tour/booking-http-contracts";
import { useTranslations } from "next-intl";

import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type BookingJourneySummaryProps = {
  readonly status: BookingListItem["status"];
  readonly paymentStatus: BookingListItem["paymentStatus"];
  readonly compact?: boolean;
};

export function BookingJourneySummary({
  status,
  paymentStatus,
  compact = false,
}: BookingJourneySummaryProps) {
  const t = useTranslations("bookings.journey");
  const journey = resolveBookingJourneyState({ status, paymentStatus });

  return (
    <p
      data-booking-journey-summary
      data-journey-state={journey}
      className={
        compact
          ? "text-[11px] leading-4 text-muted-foreground"
          : "text-xs leading-5 text-muted-foreground"
      }
    >
      {t(journey)}
    </p>
  );
}
