"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@tour/ui";

import { isLeaderRole, useAuth, type AuthUser } from "@/lib/auth/auth-context";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import { removeUser } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { useAppToast } from "@/lib/use-app-toast";
import {
  resolveWorkspaceRoleSelectUi,
  type WorkspaceRoleSelectUiHintKey,
} from "@/lib/workspace/workspace-membership-rbac-ui";

import { normalizeRole, roleLabel } from "../users-page-logic";
import styles from "../users-page.module.css";
import { USERS_ROUTE_COPY } from "../users-copy";

const copy = USERS_ROUTE_COPY.list;

function roleSelectHintForKey(key: WorkspaceRoleSelectUiHintKey): string {
  switch (key) {
    case "self":
      return copy.roleSelectHintSelf;
    case "owner_target":
      return copy.roleSelectHintOwnerTarget;
    case "unknown_role":
      return copy.roleSelectHintUnknownRole;
    case "insufficient_rank":
      return copy.roleSelectHintInsufficientRank;
    case "no_alternative_role":
      return copy.roleSelectHintNoAlternative;
    default: {
      const _n: never = key;
      return _n;
    }
  }
}

export type UserRowActionsMenuProps = {
  rowId: string;
  rowName: string;
  rowRole: string;
  rowStatus: string;
  isSelfTarget?: boolean;
  isOwnerTarget?: boolean;
  sessionUser: AuthUser | null;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRole }, unknown>;
  onManageRewards?: () => void;
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

export function UserRowActionsMenu({
  rowId,
  rowName,
  rowRole,
  rowStatus,
  isSelfTarget = false,
  isOwnerTarget = false,
  sessionUser,
  activeRoleMutationUserId,
  roleMutation,
  onManageRewards,
}: UserRowActionsMenuProps) {
  const menuId = useId();
  const ability = useAbility();
  const canMutateMembership = ability.can(AbilityAction.Update, "UserMembership");
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const tenantId = authUser?.tenantId ?? "";
  const canManageRewards = isLeaderRole(sessionUser?.role);
  const toast = useAppToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const currentNorm = normalizeRole(rowRole);
  const statusNorm = rowStatus.trim().toUpperCase();
  const isSelf = isSelfTarget || (sessionUser?.userId ?? "") === rowId;
  const isOwner = isOwnerTarget || currentNorm === "owner";
  const resolved = resolveWorkspaceRoleSelectUi({
    actorUserId: sessionUser?.userId ?? "",
    actorRole: sessionUser?.role,
    targetUserId: rowId,
    targetRole: rowRole,
    normalizedCurrentRole: currentNorm,
  });
  const rowMutationPending = activeRoleMutationUserId === rowId;
  const roleChangeDisabled =
    !canMutateMembership || rowMutationPending || resolved.disabledWithoutMutation;
  const roleHintText = useMemo(() => {
    if (rowMutationPending) return copy.roleSelectHintSaving;
    if (resolved.hintKey) return roleSelectHintForKey(resolved.hintKey);
    return null;
  }, [rowMutationPending, resolved.hintKey]);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
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

  const removeMutation = useMutation({
    mutationFn: () => removeUser(rowId),
    onSuccess: () => {
      toast.success({ message: "User removed from workspace." });
      closeMenu();
    },
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to remove user." }),
    onSettled: () => {
      if (tenantId) void queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) });
    },
  });

  const showManageRewards =
    Boolean(onManageRewards) && canManageRewards && canMutateMembership && !isSelf && !isOwner;
  const showRemove =
    canMutateMembership &&
    !removeMutation.isPending &&
    !isSelf &&
    !isOwner &&
    (statusNorm === "ACTIVE" || statusNorm === "SUSPENDED" || statusNorm === "INVITED");

  const hasAnyAction =
    canMutateMembership && (showManageRewards || showRemove || !roleChangeDisabled);

  if (!hasAnyAction) {
    return <span className={styles.rowActionsPlaceholder}>—</span>;
  }

  return (
    <div ref={rootRef} className={styles.rowActionsMenuRoot} data-skip-row-open="true">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.rowActionsTrigger}
        aria-label={copy.rowActionsMenuAriaLabel.replace("{name}", rowName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-skip-row-open="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreIcon />
      </Button>
      {open ? (
        <div id={menuId} className={styles.rowActionsMenuPanel} role="menu" data-skip-row-open="true">
          <p className={styles.rowActionsMenuSectionLabel}>{copy.menuChangeRole}</p>
          {roleChangeDisabled && roleHintText ? (
            <p className={styles.rowActionsMenuHint}>{roleHintText}</p>
          ) : (
            <ul className={styles.rowActionsMenuList}>
              {resolved.optionValues.map((role) => {
                const isCurrent = role === currentNorm;
                return (
                  <li key={role} role="none">
                    <button
                      type="button"
                      role="menuitemradio"
                      className={styles.rowActionsMenuItem}
                      aria-checked={isCurrent}
                      disabled={roleChangeDisabled || isCurrent}
                      onClick={() => {
                        roleMutation.mutate({ userId: rowId, role: role as UserRole });
                        closeMenu();
                      }}
                    >
                      {isCurrent ? `${roleLabel(role)} (${copy.menuCurrentRole})` : roleLabel(role)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {showManageRewards ? (
            <button
              type="button"
              role="menuitem"
              className={styles.rowActionsMenuItem}
              onClick={() => {
                onManageRewards?.();
                closeMenu();
              }}
            >
              {copy.menuManageRewards}
            </button>
          ) : null}
          {showRemove ? (
            <button
              type="button"
              role="menuitem"
              className={`${styles.rowActionsMenuItem} ${styles.rowActionsMenuItemDanger}`}
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {copy.menuRemoveUser}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
