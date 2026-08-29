"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BookingMemberAvatar } from "@/features/bookings/booking-member-avatar";
import { bookingPaymentLabelKey } from "@/features/bookings/booking-payment-display";
import {
  bookingPaymentBadgeVariant,
  bookingStatusBadgeVariant,
} from "@/features/bookings/bookings-badge-variants";
import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { BookingDepartureUrgencyBadge } from "@/features/bookings/booking-overdue-badge";
import {
  formatBookingDateTime,
  formatBookingDeparture,
  formatCapacitySnapshotLabel,
  resolveBookingActionablePaymentDueAt,
  resolveBookingPendingAgeDays,
  resolveBookingRowUrgencySlot,
} from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  type BookingListItem,
} from "@/features/bookings/bookings-command-center-types";
import type { AppLocale } from "@/i18n/routing";

type BookingInboxRowProps = {
  readonly item: BookingListItem;
  readonly selected: boolean;
  readonly bulkChecked: boolean;
  readonly showBulkSelect: boolean;
  readonly onBulkToggle: () => void;
  readonly onSelect: () => void;
  /** UX-BKG-48 — Approve only; never Reject/destructive. */
  readonly showInlineApprove?: boolean;
  /** UX-BKG-52 — first click armed; second confirms. */
  readonly inlineApproveArmed?: boolean;
  readonly inlineApproveBusy?: boolean;
  readonly onInlineApprove?: () => void;
  readonly onInlineApproveDisarm?: () => void;
  /** Hide repeated tour title when the parent surface is already tour-scoped. */
  readonly showTourTitle?: boolean;
};

/** UX-BKG-55 — compact selectable list row (not a per-item card). */
export function BookingInboxRow({
  item,
  selected,
  bulkChecked,
  showBulkSelect,
  onBulkToggle,
  onSelect,
  showInlineApprove = false,
  inlineApproveArmed = false,
  inlineApproveBusy = false,
  onInlineApprove,
  onInlineApproveDisarm,
  showTourTitle = true,
}: BookingInboxRowProps) {
  const t = useTranslations("bookings");
  const locale = useLocale() as AppLocale;
  const identityLabel =
    item.registrantTarget === "self" ? t("intake.registrantSelf") : t("intake.registrantOther");
  const capacityLabel = formatCapacitySnapshotLabel(item.capacitySnapshot, locale);
  const urgencySlot = resolveBookingRowUrgencySlot(item);
  const pendingAgeDays = urgencySlot === "aging" ? resolveBookingPendingAgeDays(item) : null;
  const paymentDueAt = resolveBookingActionablePaymentDueAt(item);
  const paymentDeadlineLabel =
    paymentDueAt !== undefined ? formatBookingDeparture(paymentDueAt, locale) : null;
  const departureLabel = formatBookingDeparture(item.departureAt, locale);
  const submittedLabel = t("submittedShort", {
    date: formatBookingDateTime(item.submittedAt, locale),
  });

  return (
    <div
      data-booking-row
      data-queue-row="dense"
      role="option"
      aria-selected={selected}
      className={`group flex w-full min-w-0 flex-wrap items-stretch gap-2 border-b border-border/60 transition-colors last:border-b-0 sm:flex-nowrap ${
        selected
          ? "bg-primary/5 shadow-[inset_0_0_0_1px_rgb(59_130_246/0.16)]"
          : "hover:bg-muted/40 focus-within:bg-muted/30"
      } ${inlineApproveArmed ? "ring-2 ring-inset ring-primary/40" : ""}`}
    >
      <span
        className={`w-0.5 self-stretch shrink-0 ${selected ? "bg-primary" : "bg-transparent"}`}
        aria-hidden
      />
      {showBulkSelect ? (
        <label className="flex shrink-0 items-center py-2 ps-1">
          <Checkbox
            checked={bulkChecked}
            onChange={onBulkToggle}
            aria-label={t("selectGuest", { guest: item.guestLabel })}
          />
        </label>
      ) : (
        <span className="w-1 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 basis-0 items-start gap-3 py-2.5 pe-2 text-start outline-none"
      >
        <BookingMemberAvatar item={item} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium leading-5 text-foreground">
                {item.guestLabel}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("partyShort", { count: item.partySize })}
              </span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <OperatorStatusBadge variant={bookingStatusBadgeVariant(item.status)}>
                {t(`status.${item.status}`)}
              </OperatorStatusBadge>
              <OperatorStatusBadge
                variant={bookingPaymentBadgeVariant(item.paymentStatus)}
                data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox}
                data-payment-status={item.paymentStatus}
                data-financial-display-state={item.financialDisplayState}
              >
                {t(bookingPaymentLabelKey(item))}
              </OperatorStatusBadge>
              <BookingDepartureUrgencyBadge item={item} />
            </div>
            <div className="grid gap-0.5 text-xs leading-4 text-muted-foreground">
              {showTourTitle ? <p className="truncate">{item.tourTitle}</p> : null}
              <p className="truncate">
                {t("fields.departure")}: {departureLabel}
              </p>
              {capacityLabel !== null ? (
                <p className="truncate">
                  {t("capacity")}: {capacityLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 space-y-1 text-xs leading-4 text-muted-foreground sm:w-36 sm:shrink-0 sm:text-end">
            <p className="truncate text-muted-foreground/80">
              {identityLabel} · {submittedLabel}
            </p>
            {pendingAgeDays !== null ? (
              <p className="truncate text-muted-foreground/80">
                {t("pendingAgeDays", { days: pendingAgeDays })}
              </p>
            ) : null}
            {paymentDeadlineLabel !== null ? (
              <p
                className="truncate font-medium text-foreground"
                data-operator-booking-payment-due-at
              >
                {t("paymentDueAt", { date: paymentDeadlineLabel })}
              </p>
            ) : null}
            {item.status === "cancelled" && item.cancelSource === "payment_deadline" ? (
              <span className="sr-only" data-operator-booking-cancel-source>
                payment_deadline
              </span>
            ) : null}
          </div>
        </div>
      </button>
      {showInlineApprove && onInlineApprove !== undefined ? (
        <div className="flex w-full shrink-0 justify-end border-t border-border/50 px-3 pb-2 pt-2 sm:w-auto sm:items-center sm:border-t-0 sm:px-0 sm:pe-2 sm:pt-0">
          <Button
            type="button"
            size="sm"
            variant={inlineApproveArmed ? "default" : "outline"}
            className="h-7 px-2"
            disabled={inlineApproveBusy}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inlineApproveButton}
            data-armed={inlineApproveArmed ? "true" : "false"}
            aria-label={
              inlineApproveArmed
                ? t("inlineApproveConfirmAria", { guest: item.guestLabel })
                : t("inlineApproveHintAria", { guest: item.guestLabel })
            }
            onBlur={() => {
              if (inlineApproveArmed) {
                onInlineApproveDisarm?.();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && inlineApproveArmed) {
                event.stopPropagation();
                onInlineApproveDisarm?.();
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              onInlineApprove();
            }}
          >
            <Check className="size-3.5" aria-hidden />
            <span className="ms-1 text-xs">
              {inlineApproveArmed ? t("inlineApproveConfirm") : t("approve")}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
