"use client";

/**
 * Reusable confirmation dialog for destructive or risky actions.
 * Uses `Modal` with safe defaults: initial focus on cancel, Escape/scrim call `onCancel`
 * unless an confirm action is in progress (`preventDismiss` while confirming).
 */
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";

import styles from "./ConfirmDialog.module.css";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  "data-testid"?: string;
  /** Optional hook for e2e — forwarded to the confirm button */
  confirmButtonTestId?: string;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  "data-testid": testId,
  confirmButtonTestId,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    cancelRef.current?.focus({ preventScroll: true });
  }, [open]);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  function handleCancel() {
    if (pending) return;
    onCancel();
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={title}
      preventDismiss={pending}
      closeOnScrimClick={!pending}
      data-testid={testId}
      footer={
        <>
          <Button ref={cancelRef} type="button" variant="secondary" disabled={pending} onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            loading={pending}
            data-testid={confirmButtonTestId}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className={styles.description}>{description}</p> : null}
    </Modal>
  );
}
