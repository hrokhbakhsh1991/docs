"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DENALI_CONFIRM_DIALOG_TEST_IDS,
} from "./denali-confirm-dialog-types";

type DenaliConfirmDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly confirmPending?: boolean;
  readonly confirmDisabled?: boolean;
  readonly confirmVariant?: "default" | "destructive";
  readonly testIdPrefix?: string;
};

export function DenaliConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  confirmPending = false,
  confirmDisabled = false,
  confirmVariant = "destructive",
  testIdPrefix,
}: DenaliConfirmDialogProps) {
  const dialogTestId =
    testIdPrefix != null ? `${testIdPrefix}-confirm-dialog` : DENALI_CONFIRM_DIALOG_TEST_IDS.dialog;
  const cancelTestId =
    testIdPrefix != null
      ? `${testIdPrefix}-confirm-cancel`
      : DENALI_CONFIRM_DIALOG_TEST_IDS.cancel;
  const confirmTestId =
    testIdPrefix != null
      ? `${testIdPrefix}-confirm-confirm`
      : DENALI_CONFIRM_DIALOG_TEST_IDS.confirm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-denali-surface="card"
        data-testid={dialogTestId}
        onPointerDownOutside={(event) => {
          if (confirmPending) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (confirmPending) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="text-start">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={confirmPending}
            data-testid={cancelTestId}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={confirmPending || confirmDisabled}
            data-testid={confirmTestId}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
