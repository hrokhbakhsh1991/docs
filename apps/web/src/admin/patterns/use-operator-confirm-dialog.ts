"use client";

import { useCallback, useRef, useState } from "react";

export function useOperatorConfirmDialog() {
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requestConfirmation = useCallback((action: () => void) => {
    pendingActionRef.current = action;
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setOpen(false);
    action?.();
  }, []);

  const handleCancel = useCallback(() => {
    pendingActionRef.current = null;
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      handleCancel();
      return;
    }
    setOpen(true);
  }, [handleCancel]);

  return {
    open,
    requestConfirmation,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  };
}
