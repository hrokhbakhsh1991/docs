"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

type BookingActionButtonsProps = {
  readonly busy: boolean;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly onWaitlist: () => void;
  readonly onCancel: () => void;
  readonly showApproveReject: boolean;
  readonly showWaitlist: boolean;
  readonly showCancel: boolean;
  readonly className?: string;
  readonly includeTestIds?: boolean;
};

export function BookingActionButtons({
  busy,
  onReject,
  onApprove,
  onWaitlist,
  onCancel,
  showApproveReject,
  showWaitlist,
  showCancel,
  className,
  includeTestIds = true,
}: BookingActionButtonsProps) {
  const t = useTranslations("bookings");
  return (
    <div className={`gap-2 ${className ?? "flex"}`}>
      {showApproveReject ? (
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
          {t("reject")}
        </Button>
      ) : null}
      {showWaitlist ? (
        <Button
          variant="outline"
          className="flex-1"
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
      {showApproveReject ? (
        <Button
          className="flex-1"
          disabled={busy}
          {...(includeTestIds
            ? { "data-testid": BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton }
            : {})}
          onClick={onApprove}
        >
          <Check className="me-1 size-4" />
          {t("approve")}
        </Button>
      ) : null}
      {showCancel ? (
        <Button
          variant="destructive"
          className="flex-1"
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
