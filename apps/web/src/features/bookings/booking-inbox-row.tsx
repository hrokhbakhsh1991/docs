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
  truncateBookingId,
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

function BookingInboxStatusCluster({ item }: { readonly item: BookingListItem }) {
  const t = useTranslations("bookings");

  return (
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
  );
}

function BookingInboxSubmittedMeta({
  item,
  identityLabel,
  submittedLabel,
  paymentDeadlineLabel,
  pendingAgeDays,
}: {
  readonly item: BookingListItem;
  readonly identityLabel: string;
  readonly submittedLabel: string;
  readonly paymentDeadlineLabel: string | null;
  readonly pendingAgeDays: number | null;
}) {
  const t = useTranslations("bookings");

  return (
    <div className="min-w-0 space-y-0.5 text-xs leading-4 text-muted-foreground lg:text-end">
      <p className="truncate text-muted-foreground/80">
        {identityLabel}
      </p>
      <p className="truncate">{submittedLabel}</p>
      {pendingAgeDays !== null ? (
        <p className="truncate text-muted-foreground/80">
          {t("pendingAgeDays", { days: pendingAgeDays })}
        </p>
      ) : null}
      {paymentDeadlineLabel !== null ? (
        <p className="truncate font-medium text-foreground" data-operator-booking-payment-due-at>
          {t("paymentDueAt", { date: paymentDeadlineLabel })}
        </p>
      ) : null}
      {item.status === "cancelled" && item.cancelSource === "payment_deadline" ? (
        <span className="sr-only" data-operator-booking-cancel-source>
          payment_deadline
        </span>
      ) : null}
    </div>
  );
}

/** UX-RES-01 — operational inbox row with desktop column alignment and mobile stack. */
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
  const shortBookingId = truncateBookingId(item.id, 4);

  const desktopGridClass = showTourTitle
    ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,6.5rem)_minmax(0,7.5rem)_minmax(0,5.75rem)]"
    : "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,7rem)_minmax(0,8rem)_minmax(0,6rem)]";

  return (
    <div
      data-booking-row
      data-queue-row="dense"
      role="option"
      aria-selected={selected}
      className={`group flex w-full min-w-0 items-stretch gap-2 border-b border-border/60 transition-colors last:border-b-0 ${
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
        className="flex min-w-0 flex-1 basis-0 items-start gap-3 py-3 pe-2 text-start outline-none"
        data-testid={`${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-${item.id}`}
      >
        <BookingMemberAvatar item={item} size="sm" />
        <div className={`grid min-w-0 flex-1 gap-2 ${desktopGridClass}`}>
          <div className="min-w-0 space-y-1" data-operator-booking-row-guest>
            <div className="flex min-w-0 items-baseline gap-2">
              <p className="truncate text-sm font-semibold leading-5 text-foreground lg:text-base">
                {item.guestLabel}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("partyShort", { count: item.partySize })}
              </span>
            </div>
            <p
              className="truncate font-mono text-[0.6875rem] text-muted-foreground/90"
              data-operator-booking-row-id
              title={item.id}
            >
              {shortBookingId}
            </p>
          </div>

          {showTourTitle ? (
            <p
              className="min-w-0 truncate text-sm font-medium text-foreground/90 max-lg:col-span-full"
              data-operator-booking-row-tour
            >
              {item.tourTitle}
            </p>
          ) : null}

          <div className="min-w-0 space-y-0.5 text-xs leading-4 text-muted-foreground" data-operator-booking-row-schedule>
            <p className="truncate font-medium text-foreground/90">{departureLabel}</p>
            {capacityLabel !== null ? (
              <p className="truncate">
                {t("capacity")}: {capacityLabel}
              </p>
            ) : (
              <p className="truncate lg:sr-only">
                {t("fields.departure")}: {departureLabel}
              </p>
            )}
          </div>

          <div className="min-w-0 max-lg:col-span-full" data-operator-booking-row-status>
            <BookingInboxStatusCluster item={item} />
          </div>

          <div className="min-w-0 max-lg:col-span-full" data-operator-booking-row-submitted>
            <BookingInboxSubmittedMeta
              item={item}
              identityLabel={identityLabel}
              submittedLabel={submittedLabel}
              paymentDeadlineLabel={paymentDeadlineLabel}
              pendingAgeDays={pendingAgeDays}
            />
          </div>
        </div>
      </button>
      {showInlineApprove && onInlineApprove !== undefined ? (
        <div className="flex w-full shrink-0 justify-end border-t border-border/50 px-3 pb-2 pt-2 sm:w-auto sm:items-center sm:self-center sm:border-t-0 sm:px-0 sm:pe-2 sm:pt-0">
          <Button
            type="button"
            size="sm"
            variant={inlineApproveArmed ? "default" : "outline"}
            className="h-8 min-w-[5.5rem] px-2.5"
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
