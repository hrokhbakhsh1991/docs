"use client";

import { useLocale, useTranslations } from "next-intl";

import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import {
  formatRegistrationIntakeTransportLabel,
  parseRegistrationIntakeRecord,
} from "@app-tour/workspace-sdk";

type BookingRegistrationIntakeDetailsProps = {
  readonly booking: BookingListItem;
};

export function BookingRegistrationIntakeDetails({
  booking,
}: BookingRegistrationIntakeDetailsProps) {
  const t = useTranslations("bookings");
  const locale = useLocale();
  const summary = parseRegistrationIntakeRecord(booking.registrationIntake);
  const transportLabel = formatRegistrationIntakeTransportLabel(summary, {
    primary: t("intake.transportPrimary"),
    personalCar: t("intake.transportPersonalCar"),
    noCarDong: t("intake.transportNoCarDong"),
    noCarAcquaintance: t("intake.transportNoCarAcquaintance"),
    occupants: (count) => t("intake.transportOccupants", { count, locale }),
  });

  if (
    summary.registrantTarget === null &&
    transportLabel === null &&
    summary.nationalId === null
  ) {
    return null;
  }

  return (
    <dl
      className="grid grid-cols-2 gap-2 border-t pt-4 text-sm"
      data-testid="operator-bookings-intake"
    >
      {summary.registrantTarget !== null ? (
        <>
          <dt className="text-muted-foreground">{t("fields.registrantTarget")}</dt>
          <dd>
            {summary.registrantTarget === "self"
              ? t("intake.registrantSelf")
              : t("intake.registrantOther")}
          </dd>
        </>
      ) : null}
      {transportLabel !== null ? (
        <>
          <dt className="text-muted-foreground">{t("fields.transport")}</dt>
          <dd>{transportLabel}</dd>
        </>
      ) : null}
      {summary.nationalId !== null ? (
        <>
          <dt className="text-muted-foreground">{t("fields.nationalId")}</dt>
          <dd>{summary.nationalId}</dd>
        </>
      ) : null}
    </dl>
  );
}
