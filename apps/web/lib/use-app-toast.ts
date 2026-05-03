"use client";

import { useToast } from "@tour/ui";

type ToastInput = {
  message: string;
  title?: string;
  duration?: number;
};

/**
 * App-level toast helper with semantic shortcuts.
 * Keeps one provider (`ToastProvider`) while reducing repetitive `type` wiring.
 */
export function useAppToast() {
  const { showToast } = useToast();

  return {
    success: ({ message, title, duration }: ToastInput) =>
      showToast({ type: "success", message, title, duration }),
    error: ({ message, title, duration }: ToastInput) =>
      showToast({ type: "error", message, title, duration }),
    warning: ({ message, title, duration }: ToastInput) =>
      showToast({ type: "warning", message, title, duration }),
    info: ({ message, title, duration }: ToastInput) =>
      showToast({ type: "info", message, title, duration })
  };
}
