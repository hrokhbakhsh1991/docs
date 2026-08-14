"use client";

import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  bookingPaymentBadgeVariant,
  bookingStatusBadgeVariant,
} from "@/features/bookings/bookings-badge-variants";
import { BookingDepartureUrgencyBadge } from "@/features/bookings/booking-overdue-badge";
import {
  formatBookingDateTime,
  formatBookingDeparture,
  formatCapacitySnapshotLabel,
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
}: BookingInboxRowProps) {
  const t = useTranslations("bookings");
  const locale = useLocale() as AppLocale;
  const capacityLabel = formatCapacitySnapshotLabel(item.capacitySnapshot, locale);
  const urgencySlot = resolveBookingRowUrgencySlot(item);
  const pendingAgeDays =
    urgencySlot === "aging" ? resolveBookingPendingAgeDays(item) : null;

  return (
    <div
      data-booking-row
      data-queue-row="dense"
      role="option"
      aria-selected={selected}
      className={`group flex w-full min-w-0 items-center gap-2 border-b border-border/60 last:border-b-0 ${
        selected ? "bg-primary/5" : "hover:bg-muted/40"
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
        className="min-w-0 flex-1 py-2 pe-2 text-start"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-medium leading-5">{item.guestLabel}</p>
            <p className="truncate text-xs leading-4 text-muted-foreground">
              {item.tourTitle}
              {" · "}
              {t("partyShort", { count: item.partySize })}
              {" · "}
              {formatBookingDeparture(item.departureAt, locale)}
              {capacityLabel !== null ? ` · ${capacityLabel}` : ""}
              {" · "}
              {t("submittedShort", { date: formatBookingDateTime(item.submittedAt, locale) })}
              {pendingAgeDays !== null
                ? ` · ${t("pendingAgeDays", { days: pendingAgeDays })}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <BookingDepartureUrgencyBadge item={item} />
            <Badge variant={bookingStatusBadgeVariant(item.status)} className="h-5 px-1.5 text-[10px]">
              {t(`status.${item.status}`)}
            </Badge>
            <Badge
              variant={bookingPaymentBadgeVariant(item.paymentStatus)}
              className="h-5 px-1.5 text-[10px]"
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox}
              data-payment-status={item.paymentStatus}
            >
              {t(`payment.${item.paymentStatus}`)}
            </Badge>
          </div>
        </div>
      </button>
      {showInlineApprove && onInlineApprove !== undefined ? (
        <div className="flex shrink-0 items-center pe-2">
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
