"use client";

import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";

import { BookingActivityTimeline } from "@/admin/patterns/booking-activity-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingActionButtons } from "@/features/bookings/booking-action-buttons";
import { BookingCapacityBar } from "@/features/bookings/booking-capacity-bar";
import { bookingPaymentLabelKey } from "@/features/bookings/booking-payment-display";
import {
  bookingPaymentBadgeVariant,
  bookingStatusBadgeVariant,
} from "@/features/bookings/bookings-badge-variants";
import { BookingDepartureUrgencyBadge } from "@/features/bookings/booking-overdue-badge";
import {
  formatBookingDeparture,
  truncateBookingId,
} from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingListItem,
} from "@/features/bookings/bookings-command-center-types";
import { BookingRegistrationIntakeDetails } from "@/features/bookings/booking-registration-intake-details";
import { BookingFinancialStrip } from "@/finance/booking-financial-strip";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

type BookingInspectionDetailsProps = {
  readonly booking: BookingListItem;
  readonly locale: AppLocale;
  readonly canManageOps: boolean;
  readonly canActOnSelected: boolean;
  readonly canWaitlistSelected: boolean;
  readonly canCancelSelected: boolean;
  readonly actionBusy: boolean;
  readonly idCopied: boolean;
  readonly onCopyId: () => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly onApproveWithoutPayment?: () => void;
  readonly onWaitlist: () => void;
  readonly onCancel: () => void;
  readonly actionClassName: string;
  readonly actionHint?: string | null;
  readonly capacityFullHint?: string | null;
  readonly includeActionTestIds?: boolean;
};

export function BookingInspectionDetails({
  booking,
  locale,
  canManageOps,
  canActOnSelected,
  canWaitlistSelected,
  canCancelSelected,
  actionBusy,
  idCopied,
  onCopyId,
  onReject,
  onApprove,
  onApproveWithoutPayment,
  onWaitlist,
  onCancel,
  actionClassName,
  actionHint = null,
  capacityFullHint = null,
  includeActionTestIds = true,
}: BookingInspectionDetailsProps) {
  const t = useTranslations("bookings");
  const identityLabel =
    booking.registrantTarget === "self" ? t("intake.registrantSelf") : t("intake.registrantOther");
  return (
    <>
      <div className="space-y-1">
        <p className="text-lg font-semibold">{booking.guestLabel}</p>
        <p className="text-sm text-muted-foreground">{booking.tourTitle}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t("bookingId")}:{" "}
            <span dir="ltr" className="font-mono">
              {truncateBookingId(booking.id)}
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.copyBookingIdButton}
            onClick={onCopyId}
          >
            <Copy className="me-1 size-3" />
            {idCopied ? t("copiedId") : t("copyId")}
          </Button>
        </div>
        <Badge variant="outline" className="w-fit">
          {identityLabel}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">{t("fields.party")}</dt>
        <dd>{formatLocalizedNumber(booking.partySize, locale)}</dd>
        {booking.capacitySnapshot !== undefined ? (
          <>
            <dt className="text-muted-foreground">{t("capacity")}</dt>
            <dd>
              <BookingCapacityBar snapshot={booking.capacitySnapshot} locale={locale} />
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t("fields.departure")}</dt>
        <dd>{formatBookingDeparture(booking.departureAt, locale)}</dd>
        <dt className="text-muted-foreground">{t("fields.payment")}</dt>
        <dd>
          <Badge
            variant={bookingPaymentBadgeVariant(booking.paymentStatus)}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInspection}
            data-payment-status={booking.paymentStatus}
            data-financial-display-state={booking.financialDisplayState}
          >
            {t(bookingPaymentLabelKey(booking))}
          </Badge>
        </dd>
        <dt className="text-muted-foreground">{t("fields.status")}</dt>
        <dd className="flex flex-wrap items-center gap-1">
          <Badge variant={bookingStatusBadgeVariant(booking.status)}>
            {t(`status.${booking.status}`)}
          </Badge>
          <BookingDepartureUrgencyBadge item={booking} />
        </dd>
        {booking.guestPhone !== undefined && booking.guestPhone.length > 0 ? (
          <>
            <dt className="text-muted-foreground">{t("fields.phone")}</dt>
            <dd dir="ltr" className="text-start">
              {formatIranMobileForDisplay(booking.guestPhone)}
            </dd>
          </>
        ) : null}
        {booking.guestEmail !== undefined && booking.guestEmail.length > 0 ? (
          <>
            <dt className="text-muted-foreground">{t("fields.email")}</dt>
            <dd dir="ltr" className="text-start">
              {booking.guestEmail}
            </dd>
          </>
        ) : null}
        {booking.rejectReason !== undefined && booking.rejectReason.length > 0 ? (
          <>
            <dt className="text-muted-foreground">{t("fields.rejectReason")}</dt>
            <dd>{booking.rejectReason}</dd>
          </>
        ) : null}
      </dl>
      {/* PR21-G2: money state before ops/cancel so finance is not buried. */}
      <BookingFinancialStrip
        registrationId={booking.id}
        bookingPaymentStatus={booking.paymentStatus}
        bookingStatus={booking.status}
      />
      {canManageOps &&
      (canActOnSelected || canWaitlistSelected || canCancelSelected || actionHint !== null) ? (
        <BookingActionButtons
          busy={actionBusy}
          showApproveReject={canActOnSelected}
          showWaitlist={canWaitlistSelected}
          showCancel={canCancelSelected}
          onReject={onReject}
          onApprove={onApprove}
          onApproveWithoutPayment={onApproveWithoutPayment}
          onWaitlist={onWaitlist}
          onCancel={onCancel}
          className={actionClassName}
          actionHint={actionHint}
          capacityFullHint={capacityFullHint}
          includeTestIds={includeActionTestIds}
        />
      ) : null}
      <BookingRegistrationIntakeDetails booking={booking} />
      <BookingActivityTimeline booking={booking} />
    </>
  );
}
