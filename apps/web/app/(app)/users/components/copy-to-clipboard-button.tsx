"use client";

import { useCallback } from "react";

import { useAppToast } from "@/lib/use-app-toast";

import styles from "../users-page.module.css";

type CopyToClipboardButtonProps = {
  value: string;
  ariaLabel: string;
  successToast: string;
  disabled?: boolean;
};

export function CopyToClipboardButton({
  value,
  ariaLabel,
  successToast,
  disabled = false
}: CopyToClipboardButtonProps): JSX.Element {
  const toast = useAppToast();

  const handleCopy = useCallback(async () => {
    const text = value.trim();
    if (!text || disabled) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success({ message: successToast });
    } catch {
      toast.error({ message: "کپی انجام نشد" });
    }
  }, [disabled, successToast, toast, value]);

  return (
    <button
      type="button"
      className={styles.copyIconButton}
      aria-label={ariaLabel}
      disabled={disabled || !value.trim()}
      onClick={() => void handleCopy()}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
        />
      </svg>
    </button>
  );
}
