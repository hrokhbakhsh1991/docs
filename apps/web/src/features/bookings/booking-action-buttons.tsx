"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

type BookingActionButtonsProps = {
  readonly busy: boolean;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly onApproveWithoutPayment?: () => void;
  readonly onWaitlist: () => void;
  readonly onPromoteWaitlistWithCapacityIncrease?: () => void;
  readonly onCancel: () => void;
  readonly onApproveMemberCancellation?: () => void;
  readonly onRejectMemberCancellation?: () => void;
  readonly showReject: boolean;
  readonly showApprove: boolean;
  readonly showWaitlist: boolean;
  readonly showPromoteWaitlistWithCapacityIncrease?: boolean;
  readonly showCancel: boolean;
  readonly showMemberCancellationDecision?: boolean;
  readonly actionHint?: string | null;
  readonly capacityFullHint?: string | null;
  readonly className?: string;
  readonly includeTestIds?: boolean;
};

export function BookingActionButtons({
  busy,
  onReject,
  onApprove,
  onApproveWithoutPayment,
  onWaitlist,
  onPromoteWaitlistWithCapacityIncrease,
  onCancel,
  onApproveMemberCancellation,
  onRejectMemberCancellation,
  showReject,
  showApprove,
  showWaitlist,
  showPromoteWaitlistWithCapacityIncrease = false,
  showCancel,
  showMemberCancellationDecision = false,
  actionHint = null,
  capacityFullHint = null,
  className,
  includeTestIds = true,
}: BookingActionButtonsProps) {
  const t = useTranslations("bookings");
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {capacityFullHint !== null && capacityFullHint.length > 0 ? (
        <p
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-950 dark:text-amber-100"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.capacityFullHint}
        >
          {capacityFullHint}
        </p>
      ) : null}
      {actionHint !== null && actionHint.length > 0 ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionUnavailableHint}
        >
          {actionHint}
        </p>
      ) : null}
      {showMemberCancellationDecision &&
      onApproveMemberCancellation !== undefined &&
      onRejectMemberCancellation !== undefined ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
          <p className="mb-2 text-xs font-medium text-amber-950 dark:text-amber-100">
            {t("memberCancellation.reviewHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-w-0 flex-1"
              disabled={busy}
              {...(includeTestIds
                ? {
                    "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectMemberCancellationButton,
                  }
                : {})}
              onClick={onRejectMemberCancellation}
            >
              <X className="me-1 size-4" />
              {t("memberCancellation.rejectAction")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-w-0 flex-1"
              disabled={busy}
              {...(includeTestIds
                ? {
                    "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.approveMemberCancellationButton,
                  }
                : {})}
              onClick={onApproveMemberCancellation}
            >
              <Check className="me-1 size-4" />
              {t("memberCancellation.approveAction")}
            </Button>
          </div>
        </div>
      ) : null}
      {showReject ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            {...(includeTestIds
              ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton }
              : {})}
            onClick={onReject}
          >
            <X className="me-1 size-4" />
            {t("rejectRegistration")}
          </Button>
          {showApprove && onApproveWithoutPayment !== undefined ? (
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              {...(includeTestIds
                ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.approveWithoutPaymentButton }
                : {})}
              onClick={onApproveWithoutPayment}
            >
              {t("approveWithoutPayment")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {showApprove ? (
        <Button
          className="w-full"
          disabled={busy}
          {...(includeTestIds
            ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton }
            : {})}
          onClick={onApprove}
        >
          <Check className="me-1 size-4" />
          {t("approveAwaitingPayment")}
        </Button>
      ) : null}
      {showWaitlist ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          aria-label={t("waitlistActionAria")}
          {...(includeTestIds
            ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.waitlistButton }
            : {})}
          onClick={onWaitlist}
        >
          {t("waitlist")}
        </Button>
      ) : null}
      {showPromoteWaitlistWithCapacityIncrease && onPromoteWaitlistWithCapacityIncrease ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          data-testid="operator-bookings-promote-waitlist-with-capacity-increase"
          onClick={onPromoteWaitlistWithCapacityIncrease}
        >
          {t("promoteWaitlistWithCapacityIncrease")}
        </Button>
      ) : null}
      {showCancel ? (
        <Button
          variant="destructive"
          className="w-full"
          disabled={busy}
          {...(includeTestIds
            ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelButton }
            : {})}
          onClick={onCancel}
        >
          {t("cancelBooking")}
        </Button>
      ) : null}
    </div>
  );
}
