"use client";

import { useToast } from "@tour/ui";
import { useEffect } from "react";

import { GLOBAL_API_TOAST_EVENT, type GlobalApiToastDetail } from "@/lib/global-api-toast";

/**
 * Subscribes to {@link GLOBAL_API_TOAST_EVENT} and forwards payloads into `@tour/ui` toasts.
 */
export function GlobalApiToastBridge() {
  const { showToast } = useToast();

  useEffect(() => {
    function onToast(ev: Event) {
      const e = ev as CustomEvent<GlobalApiToastDetail>;
      const detail = e.detail;
      if (!detail?.message?.trim()) return;
      showToast({
        type: detail.type ?? "error",
        message: detail.message.trim(),
      });
    }
    window.addEventListener(GLOBAL_API_TOAST_EVENT, onToast);
    return () => window.removeEventListener(GLOBAL_API_TOAST_EVENT, onToast);
  }, [showToast]);

  return null;
}
