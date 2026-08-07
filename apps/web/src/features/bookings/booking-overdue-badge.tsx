"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { resolveBookingDepartureUrgency } from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingListItem,
} from "@/features/bookings/bookings-command-center-types";

type BookingDepartureUrgencyBadgeProps = {
  readonly item: Pick<BookingListItem, "departureAt" | "status">;
  readonly now?: Date;
};

/** Overdue or Soon (&lt;48h) — at most one badge (UX-BKG-47). */
export function BookingDepartureUrgencyBadge({
  item,
  now,
}: BookingDepartureUrgencyBadgeProps) {
  const t = useTranslations("bookings");
  const urgency = resolveBookingDepartureUrgency(item, now);
  if (urgency === "overdue") {
    return (
      <Badge
        variant="destructive"
        className="h-5 px-1.5 text-[10px]"
        data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.overdueBadge}
      >
        {t("overdue")}
      </Badge>
    );
  }
  if (urgency === "soon") {
    return (
      <Badge
        variant="outline"
        className="h-5 px-1.5 text-[10px]"
        data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.soonBadge}
      >
        {t("soon48h")}
      </Badge>
    );
  }
  return null;
}

/** @deprecated Prefer BookingDepartureUrgencyBadge — kept for call-site stability. */
export function BookingOverdueBadge(props: BookingDepartureUrgencyBadgeProps) {
  return <BookingDepartureUrgencyBadge {...props} />;
}
