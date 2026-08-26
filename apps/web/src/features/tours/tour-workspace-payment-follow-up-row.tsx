"use client";

import { useTranslations } from "next-intl";

import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";
import { Button } from "@/components/ui/button";
import { bookingPaymentBadgeVariant } from "@/features/bookings/bookings-badge-variants";
import { formatBookingDeparture } from "@/features/bookings/bookings-command-center-logic";
import {
  paymentFollowUpPrimaryActionLabelKey,
  shouldShowPaymentFollowUpDeadline,
  type PaymentFollowUpPrimaryActionKind,
  type TourWorkspacePaymentFollowUpParticipantRow,
} from "@/features/tours/tour-workspace-payment-follow-up-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export const TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS = {
  row: "operator-tour-workspace-payment-follow-up-row",
  avatar: "operator-tour-workspace-payment-follow-up-avatar",
  registrationBadge: "operator-tour-workspace-payment-follow-up-registration-badge",
  paymentBadge: "operator-tour-workspace-payment-follow-up-payment-badge",
  amountDue: "operator-tour-workspace-payment-follow-up-amount-due",
  deadline: "operator-tour-workspace-payment-follow-up-deadline",
  primaryAction: "operator-tour-workspace-payment-follow-up-primary-action",
  secondaryAction: "operator-tour-workspace-payment-follow-up-secondary-action",
  completed: "operator-tour-workspace-payment-follow-up-completed",
} as const;

type TourWorkspacePaymentFollowUpRowProps = {
  readonly row: TourWorkspacePaymentFollowUpParticipantRow;
  readonly locale: AppLocale;
  readonly selected: boolean;
  readonly highlighted: boolean;
  readonly busy?: boolean;
  readonly onSelect: () => void;
  readonly onPrimaryAction: (action: PaymentFollowUpPrimaryActionKind, registrationId: string) => void;
  readonly onSecondaryAction?: (action: PaymentFollowUpPrimaryActionKind, registrationId: string) => void;
};

function registrationBadgeLabel(
  tBookings: ReturnType<typeof useTranslations>,
  tFinance: ReturnType<typeof useTranslations>,
  row: TourWorkspacePaymentFollowUpParticipantRow
): string {
  if (tBookings.has(row.registrationStatus)) {
    return tBookings(row.registrationStatus);
  }
  if (row.listKind === "settled") {
    return tFinance("rowSettled");
  }
  return row.registrationStatus;
}

function paymentBadgeLabel(
  tBookings: ReturnType<typeof useTranslations>,
  tTransport: ReturnType<typeof useTranslations>,
  row: TourWorkspacePaymentFollowUpParticipantRow
): string {
  if (row.registrationStatus === "pending") {
    return tBookings("payment.unpaid");
  }
  if (row.financialDisplayState !== null && tTransport.has(`financial.${row.financialDisplayState}`)) {
    return tTransport(`financial.${row.financialDisplayState}`);
  }
  if (row.bookingPaymentStatus !== null) {
    return tBookings(`payment.${row.bookingPaymentStatus}`);
  }
  return tBookings("payment.unpaid");
}

export function TourWorkspacePaymentFollowUpRow({
  row,
  locale,
  selected,
  highlighted,
  busy = false,
  onSelect,
  onPrimaryAction,
  onSecondaryAction,
}: TourWorkspacePaymentFollowUpRowProps) {
  const tFinance = useTranslations("tours.workspace.finance");
  const tBookings = useTranslations("bookings");
  const tBookingsStatus = useTranslations("bookings.status");
  const tTransport = useTranslations("tours.workspace.transport");
  const amountLabel =
    row.remainingMinor !== null &&
    row.currency !== null &&
    row.remainingMinor.trim() !== "" &&
    row.remainingMinor !== "0"
      ? formatMinorAmount(row.remainingMinor, row.currency, locale)
      : null;
  const paymentStatus = row.bookingPaymentStatus ?? "unpaid";
  const showDeadline = shouldShowPaymentFollowUpDeadline(row);
  const deadlineLabel =
    showDeadline && row.paymentDueAt !== null
      ? formatBookingDeparture(row.paymentDueAt, locale)
      : null;
  const primaryLabelKey = paymentFollowUpPrimaryActionLabelKey(row.primaryAction);
  const secondaryLabelKey =
    row.secondaryAction !== null
      ? paymentFollowUpPrimaryActionLabelKey(row.secondaryAction)
      : null;
  const primaryLabelNamespace =
    row.primaryAction === "approve_awaiting_payment" ||
    row.primaryAction === "approve_without_payment"
      ? tBookings
      : tFinance;
  const secondaryLabelNamespace =
    row.secondaryAction === "approve_without_payment" ? tBookings : tFinance;

  return (
    <div
      data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.row}
      data-finance-registration-id={row.registrationId}
      data-follow-up-kind={row.listKind}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 transition-colors",
        highlighted && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
        selected
          ? "border-primary/50 bg-primary/[0.07] shadow-sm"
          : "border-border bg-background"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        onClick={onSelect}
      >
        <OperatorProfileAvatar
          userId={row.memberUserId ?? row.registrationId}
          displayName={row.displayName}
          avatarUrl={row.memberAvatarUrl ?? null}
          size="sm"
          fallbackMode="icon"
          testId={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.avatar}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{row.displayName}</p>
            {amountLabel !== null ? (
              <span
                className="shrink-0 text-sm font-semibold tabular-nums text-foreground"
                data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.amountDue}
              >
                {amountLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <OperatorStatusBadge
              variant="outline"
              data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.registrationBadge}
            >
              {registrationBadgeLabel(tBookingsStatus, tFinance, row)}
            </OperatorStatusBadge>
            <OperatorStatusBadge
              variant={bookingPaymentBadgeVariant(paymentStatus)}
              data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.paymentBadge}
              data-payment-status={paymentStatus}
              data-financial-display-state={row.financialDisplayState ?? undefined}
            >
              {paymentBadgeLabel(tBookings, tTransport, row)}
            </OperatorStatusBadge>
            {row.isFinalParticipant ? (
              <OperatorStatusBadge variant="default">
                {row.financialDisplayState === "WAIVED"
                  ? tFinance("rowWaivedNoPayment")
                  : row.financialDisplayState === "PAID"
                    ? tFinance("rowPaidReceived")
                    : tFinance("rowFinalParticipant")}
              </OperatorStatusBadge>
            ) : null}
          </div>
          {deadlineLabel !== null ? (
            <p
              className="mt-1 text-xs text-muted-foreground"
              data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.deadline}
            >
              {tFinance("rowDeadline", { date: deadlineLabel })}
            </p>
          ) : null}
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        {primaryLabelKey !== null && row.primaryAction !== "none" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.primaryAction}
            data-action-kind={row.primaryAction}
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction(row.primaryAction, row.registrationId);
            }}
          >
            {primaryLabelNamespace(primaryLabelKey)}
          </Button>
        ) : row.listKind === "settled" ? (
          <span
            className="text-xs font-medium text-muted-foreground"
            data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.completed}
          >
            {tFinance("rowCompleted")}
          </span>
        ) : null}
        {secondaryLabelKey !== null && row.secondaryAction !== null && onSecondaryAction !== undefined ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid={TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.secondaryAction}
            data-action-kind={row.secondaryAction}
            onClick={(event) => {
              event.stopPropagation();
              onSecondaryAction(row.secondaryAction!, row.registrationId);
            }}
          >
            {secondaryLabelNamespace(secondaryLabelKey)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
