"use client";

import { useTranslations } from "next-intl";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

type BookingInboxColumnHeaderProps = {
  readonly showTourTitle?: boolean;
  readonly showBulkSelect?: boolean;
};

/** UX-RES-01 — desktop column guide for dense inbox scanning (hidden on mobile). */
export function BookingInboxColumnHeader({
  showTourTitle = true,
  showBulkSelect = false,
}: BookingInboxColumnHeaderProps) {
  const t = useTranslations("bookings");

  return (
    <div
      role="presentation"
      data-operator-booking-list-header
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxColumnHeader}
      className={`hidden border-b border-border/70 bg-muted/35 text-xs font-medium text-muted-foreground lg:grid lg:items-center lg:gap-x-3 lg:px-3 lg:py-2 ${
        showTourTitle
          ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,6.5rem)_minmax(0,7.5rem)_minmax(0,5.75rem)]"
          : "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,7rem)_minmax(0,8rem)_minmax(0,6rem)]"
      } ${showBulkSelect ? "lg:ps-10" : ""}`}
    >
      <span>{t("columns.guest")}</span>
      {showTourTitle ? <span>{t("columns.tour")}</span> : null}
      <span>{t("columns.departure")}</span>
      <span>{t("columns.status")}</span>
      <span className="text-end">{t("columns.submitted")}</span>
    </div>
  );
}
