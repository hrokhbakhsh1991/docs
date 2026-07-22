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
  OPERATOR_CONFIRM_DIALOG_TEST_IDS,
} from "./operator-confirm-dialog-types";

type OperatorConfirmDialogProps = {
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

export function OperatorConfirmDialog({
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
}: OperatorConfirmDialogProps) {
  const dialogTestId =
    testIdPrefix != null ? `${testIdPrefix}-confirm-dialog` : OPERATOR_CONFIRM_DIALOG_TEST_IDS.dialog;
  const cancelTestId =
    testIdPrefix != null
      ? `${testIdPrefix}-confirm-cancel`
      : OPERATOR_CONFIRM_DIALOG_TEST_IDS.cancel;
  const confirmTestId =
    testIdPrefix != null
      ? `${testIdPrefix}-confirm-confirm`
      : OPERATOR_CONFIRM_DIALOG_TEST_IDS.confirm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-operator-confirm-dialog
        data-operator-surface="card"
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
        <DialogHeader data-operator-confirm-dialog-header>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter data-operator-confirm-dialog-footer>
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
