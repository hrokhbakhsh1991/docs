"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import {
  cancelWorkspaceInvite,
  resendInvite,
  resendWorkspaceInvite,
  type PendingWorkspaceInviteDto
} from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import { USERS_ROUTE_COPY } from "../users-copy";
import styles from "../users-page.module.css";

const copy = USERS_ROUTE_COPY.list;

const MENU_PANEL_MIN_WIDTH_PX = 200;

type PendingInviteActionsMenuProps = {
  row: PendingWorkspaceInviteDto;
  onActionSettled?: () => void | Promise<void>;
};

function MoreIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx={5} cy={12} r={1.75} fill="currentColor" />
      <circle cx={12} cy={12} r={1.75} fill="currentColor" />
      <circle cx={19} cy={12} r={1.75} fill="currentColor" />
    </svg>
  );
}

export function PendingInviteActionsMenu({
  row,
  onActionSettled
}: PendingInviteActionsMenuProps): JSX.Element {
  const menuId = useId();
  const toast = useAppToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelCoords, setPanelCoords] = useState<{ top: number; left: number } | null>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  const updatePanelCoords = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.left;
    const maxLeft = window.innerWidth - MENU_PANEL_MIN_WIDTH_PX - margin;
    if (left > maxLeft) {
      left = maxLeft;
    }
    setPanelCoords({
      top: rect.bottom + 4,
      left
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelCoords(null);
      return;
    }
    updatePanelCoords();
    window.addEventListener("resize", updatePanelCoords);
    window.addEventListener("scroll", updatePanelCoords, true);
    return () => {
      window.removeEventListener("resize", updatePanelCoords);
      window.removeEventListener("scroll", updatePanelCoords, true);
    };
  }, [open, updatePanelCoords]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && panelRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  const resendMutation = useMutation({
    mutationFn: async () => {
      if (row.userId) {
        return resendInvite(row.userId);
      }
      return resendWorkspaceInvite(row.inviteId);
    },
    onSuccess: async () => {
      toast.success({ message: copy.pendingResendSuccessToast });
      closeMenu();
      await onActionSettled?.();
    },
    onError: (e: unknown) =>
      toast.error({
        message: e instanceof ApiError ? e.message : copy.pendingActionErrorFallback
      })
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelWorkspaceInvite(row.inviteId),
    onSuccess: async () => {
      toast.success({ message: copy.pendingCancelSuccessToast });
      closeMenu();
      await onActionSettled?.();
    },
    onError: (e: unknown) =>
      toast.error({
        message: e instanceof ApiError ? e.message : copy.pendingActionErrorFallback
      })
  });

  const isPending = resendMutation.isPending || cancelMutation.isPending;

  const menuPanel =
    open && panelCoords && typeof document !== "undefined" ? (
      <div
        id={menuId}
        ref={panelRef}
        role="menu"
        className={`${styles.rowActionsMenuPanel} ${styles.rowActionsMenuPanelFloating} ${styles.pendingInviteActionsPanel}`}
        style={{ top: panelCoords.top, left: panelCoords.left }}
      >
        <ul className={styles.rowActionsMenuList}>
          <li>
            <button
              type="button"
              role="menuitem"
              className={styles.rowActionsMenuItem}
              disabled={isPending}
              onClick={() => resendMutation.mutate()}
            >
              {copy.pendingResendSms}
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              className={`${styles.rowActionsMenuItem} ${styles.rowActionsMenuItemDanger}`}
              disabled={isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {copy.pendingCancelInvite}
            </button>
          </li>
        </ul>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={styles.rowActionsMenuRoot}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.rowActionsTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={isPending}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreIcon />
      </Button>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
