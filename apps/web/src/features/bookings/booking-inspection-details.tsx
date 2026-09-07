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
  resolveBookingActionablePaymentDueAt,
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
  readonly onMarkPresent?: () => void;
  readonly onMarkAbsent?: () => void;
  readonly canMarkPresent?: boolean;
  readonly canMarkAbsent?: boolean;
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
  onMarkPresent,
  onMarkAbsent,
  canMarkPresent = false,
  canMarkAbsent = false,
  actionClassName,
  actionHint = null,
  capacityFullHint = null,
  includeActionTestIds = true,
}: BookingInspectionDetailsProps) {
  const t = useTranslations("bookings");
  const identityLabel =
    booking.registrantTarget === "self" ? t("intake.registrantSelf") : t("intake.registrantOther");
  const paymentDueAt = resolveBookingActionablePaymentDueAt(booking);
  const paymentDeadlineLabel =
    paymentDueAt !== undefined ? formatBookingDeparture(paymentDueAt, locale) : null;
  return (
    <>
      <div className="space-y-2">
        <div>
          <p className="text-lg font-semibold">{booking.guestLabel}</p>
          <p className="text-sm text-muted-foreground">{booking.tourTitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={bookingStatusBadgeVariant(booking.status)}>
            {t(`status.${booking.status}`)}
          </Badge>
          {booking.attendanceStatus === "present" || booking.attendanceStatus === "absent" ? (
            <Badge variant="secondary">{t(`attendance.${booking.attendanceStatus}`)}</Badge>
          ) : null}
          <Badge
            variant={bookingPaymentBadgeVariant(booking.paymentStatus)}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInspection}
            data-payment-status={booking.paymentStatus}
            data-financial-display-state={booking.financialDisplayState}
          >
            {t(bookingPaymentLabelKey(booking))}
          </Badge>
          <BookingDepartureUrgencyBadge item={booking} />
        </div>
        <Badge variant="outline" className="w-fit">
          {identityLabel}
        </Badge>
      </div>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("fields.party")}</dt>
        <dd>{formatLocalizedNumber(booking.partySize, locale)}</dd>
        <dt className="text-muted-foreground">{t("fields.departure")}</dt>
        <dd>{formatBookingDeparture(booking.departureAt, locale)}</dd>
        {paymentDeadlineLabel !== null ? (
          <>
            <dt className="text-muted-foreground">{t("fields.payment")}</dt>
            <dd>{t("paymentDueAt", { date: paymentDeadlineLabel })}</dd>
          </>
        ) : null}
        {booking.capacitySnapshot !== undefined ? (
          <>
            <dt className="text-muted-foreground">{t("capacity")}</dt>
            <dd>
              <BookingCapacityBar snapshot={booking.capacitySnapshot} locale={locale} />
            </dd>
          </>
        ) : null}
      </dl>
      {canManageOps &&
      (canActOnSelected ||
        canWaitlistSelected ||
        canCancelSelected ||
        canMarkPresent ||
        canMarkAbsent ||
        actionHint !== null) ? (
        <BookingActionButtons
          busy={actionBusy}
          showApproveReject={canActOnSelected}
          showWaitlist={canWaitlistSelected}
          showCancel={canCancelSelected}
          showMarkPresent={canMarkPresent}
          showMarkAbsent={canMarkAbsent}
          onReject={onReject}
          onApprove={onApprove}
          onApproveWithoutPayment={onApproveWithoutPayment}
          onWaitlist={onWaitlist}
          onCancel={onCancel}
          onMarkPresent={onMarkPresent}
          onMarkAbsent={onMarkAbsent}
          className={actionClassName}
          actionHint={actionHint}
          capacityFullHint={capacityFullHint}
          includeTestIds={includeActionTestIds}
        />
      ) : null}
      <details className="rounded-md border border-dashed px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          {t("detailSections.contact")}
        </summary>
        <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("bookingId")}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span dir="ltr" className="font-mono">
              {truncateBookingId(booking.id)}
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
      </details>
      <details className="rounded-md border border-dashed px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          {t("detailSections.payment")}
        </summary>
        <div className="mt-3">
          <BookingFinancialStrip
            registrationId={booking.id}
            bookingPaymentStatus={booking.paymentStatus}
            bookingStatus={booking.status}
            financialDisplayState={booking.financialDisplayState}
          />
        </div>
      </details>
      <details className="rounded-md border border-dashed px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          {t("detailSections.intake")}
        </summary>
        <div className="mt-3">
          <BookingRegistrationIntakeDetails booking={booking} />
        </div>
      </details>
      <details className="rounded-md border border-dashed px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          {t("detailSections.history")}
        </summary>
        <div className="mt-3">
          <BookingActivityTimeline booking={booking} />
        </div>
      </details>
    </>
  );
}
