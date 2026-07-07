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
    <ol data-denali-booking-timeline>
      {events.map((event, index) => (
        <li key={event.id} data-booking-timeline-item>
          <span data-booking-timeline-marker aria-hidden>
            <span data-booking-timeline-dot />
            {index < events.length - 1 ? <span data-booking-timeline-rail /> : null}
          </span>
          <div data-booking-timeline-body>
            <p data-booking-timeline-label>{event.label}</p>
            <p data-booking-timeline-detail>{event.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
