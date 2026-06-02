"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Alert } from "../Alert/Alert";

import { ToastContext } from "./toast-context";
import styles from "./Toast.module.css";
import type { ShowToastOptions, Toast, ToastType } from "./types";

export type ToastProviderProps = {
  children: ReactNode;
};

const DEFAULT_DURATION_MS = 4500;

function variantForType(type: ToastType | undefined): "info" | "success" | "warning" | "error" {
  switch (type) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "error";
    default:
      return "info";
  }
}

function nextToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** App-wide toast viewport (portal). Pair with `useToast`. */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** Portal mounts only after hydration — avoids SSR/client markup mismatch (`document` exists only on client). */
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    setMounted(true);
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    (options: ShowToastOptions) => {
      const id = nextToastId();
      const duration = options.duration ?? DEFAULT_DURATION_MS;
      const toast: Toast = {
        id,
        title: options.title,
        message: options.message,
        type: options.type ?? "info",
        duration,
      };
      setToasts((prev) => [...prev, toast]);
      if (duration > 0) {
        const tid = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, tid);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const viewport = (
    <div className={styles.viewport} aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast}>
          <Alert variant={variantForType(toast.type)} title={toast.title} className={styles.alert}>
            {toast.message}
          </Alert>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted ? createPortal(viewport, document.body) : null}
    </ToastContext.Provider>
  );
}
