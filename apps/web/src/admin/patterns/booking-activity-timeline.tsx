"use client";

import { useLocale, useTranslations } from "next-intl";

import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import type { AppLocale } from "@/i18n/routing";

type BookingActivityTimelineProps = {
  readonly booking: BookingListItem;
};

export function BookingActivityTimeline({ booking }: BookingActivityTimelineProps) {
  const t = useTranslations("bookings.timeline");
  const locale = useLocale() as AppLocale;

  const events = [
    {
      id: "submitted",
      label: t("submitted"),
      detail: formatBookingDeparture(booking.submittedAt, locale),
    },
    {
      id: "status",
      label: t("status"),
      detail: t(`statusValue.${booking.status}`),
    },
    {
      id: "payment",
      label: t("payment"),
      detail: t(`paymentValue.${booking.paymentStatus}`),
    },
    {
      id: "departure",
      label: t("departure"),
      detail: formatBookingDeparture(booking.departureAt, locale),
    },
  ] as const;

  return (
    <ol className="space-y-0" data-denali-booking-timeline>
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0" data-booking-timeline-item>
          <span className="relative mt-1.5 flex w-2 shrink-0 justify-center" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-primary" />
            {index < events.length - 1 ? (
              <span className="absolute top-3 bottom-0 w-px bg-border" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{event.label}</p>
            <p className="text-sm text-foreground">{event.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
