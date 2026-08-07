"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "@/features/bookings/bookings-command-center-types";

type BookingsRejectDialogProps = {
  readonly open: boolean;
  readonly reason: string;
  readonly busy: boolean;
  readonly canConfirm: boolean;
  /** Manifest `reject.requiresReason` (UX-BKG-46). Default false. */
  readonly requiresReason?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onReasonChange: (reason: string) => void;
  readonly onConfirm: () => void;
};

export function BookingsRejectDialog({
  open,
  reason,
  busy,
  canConfirm,
  requiresReason = false,
  onOpenChange,
  onReasonChange,
  onConfirm,
}: BookingsRejectDialogProps) {
  const t = useTranslations("bookings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog}>
        <DialogHeader>
          <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
          <DialogDescription>
            {requiresReason
              ? t("rejectDialogDescriptionRequired")
              : t("rejectDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <Input
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={
            requiresReason
              ? t("rejectReasonPlaceholderRequired")
              : t("rejectReasonPlaceholder")
          }
          disabled={busy}
          required={requiresReason}
          aria-required={requiresReason}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("rejectCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || !canConfirm}
            onClick={onConfirm}
          >
            {t("rejectConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BookingsBulkConfirmDialogProps = {
  readonly open: boolean;
  readonly count: number;
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

export function BookingsBulkConfirmDialog({
  open,
  count,
  busy,
  onOpenChange,
  onConfirm,
}: BookingsBulkConfirmDialogProps) {
  const t = useTranslations("bookings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkConfirmDialog}>
        <DialogHeader>
          <DialogTitle>{t("bulkConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("bulkConfirmDescription", { count })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("bulkConfirmCancel")}
          </Button>
          <Button type="button" disabled={busy || count === 0} onClick={onConfirm}>
            {t("bulkConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BookingsCancelConfirmDialogProps = {
  readonly open: boolean;
  readonly busy: boolean;
  readonly guestLabel: string;
  readonly tourTitle: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

/** UX-BKG-52 — cancel requires explicit confirm (no reason field). */
export function BookingsCancelConfirmDialog({
  open,
  busy,
  guestLabel,
  tourTitle,
  onOpenChange,
  onConfirm,
}: BookingsCancelConfirmDialogProps) {
  const t = useTranslations("bookings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmDialog}>
        <DialogHeader>
          <DialogTitle>{t("cancelDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("cancelDialogDescription", { guest: guestLabel, tour: tourTitle })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t("cancelDialogKeep")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmButton}
          >
            {t("cancelDialogConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
