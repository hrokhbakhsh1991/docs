"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../utils/cn";
import { listFocusables } from "../../utils/a11y";
import styles from "./Modal.module.css";

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** If false, clicking scrim does not call onClose */
  closeOnScrimClick?: boolean;
  /** When true, Escape, scrim, and the header close control do not dismiss */
  preventDismiss?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeOnScrimClick = true,
  preventDismiss = false,
  className,
  ...rest
}: ModalProps) {
  const titleId = useId();
  const panelId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      previouslyFocusedRef.current = active;
    }
    dialogRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open) return;
    const restore = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (restore?.isConnected) {
      restore.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (preventDismiss) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = listFocusables(dialog);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (focusables.length === 0) {
        return;
      }

      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        if (active === dialog || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === dialog || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, preventDismiss]);

  if (!open) return null;

  const node = (
    <div className={cn(styles.root, className)} role="presentation" {...rest}>
      <div
        className={styles.scrim}
        aria-hidden
        onMouseDown={() => {
          if (preventDismiss || !closeOnScrimClick) return;
          onClose();
        }}
      />
      <div
        ref={dialogRef}
        id={panelId}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close dialog"
            disabled={preventDismiss}
            onClick={() => {
              if (!preventDismiss) onClose();
            }}
          >
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
