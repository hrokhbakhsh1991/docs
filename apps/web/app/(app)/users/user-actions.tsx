"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo } from "react";

import { Button, Select } from "@tour/ui";

import { useAuth, type AuthUser } from "@/lib/auth/auth-context";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import {
  reactivateUser,
  removeUser,
  resendInvite,
  suspendUser,
} from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";
import { useAppToast } from "@/lib/use-app-toast";
import {
  resolveWorkspaceRoleSelectUi,
  type WorkspaceRoleSelectUiHintKey
} from "@/lib/workspace/workspace-membership-rbac-ui";

import { normalizeRole, roleLabel } from "./users-page-logic";
import styles from "./users-page.module.css";
import { USERS_ROUTE_COPY } from "./users-copy";

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

type UserActionsProps = {
  rowId: string;
  rowName: string;
  rowRole: string;
  rowStatus: string;
  isSelfTarget?: boolean;
  isOwnerTarget?: boolean;
  sessionUser: AuthUser | null;
  activeRoleMutationUserId: string | null;
  roleMutation: UseMutationResult<WorkspaceUserDto, unknown, { userId: string; role: UserRole }, unknown>;
  onOpenProfile: () => void;
};

export function UserActions({
  rowId,
  rowName,
  rowRole,
  rowStatus,
  isSelfTarget = false,
  isOwnerTarget = false,
  sessionUser,
  activeRoleMutationUserId,
  roleMutation,
  onOpenProfile
}: UserActionsProps) {
  const ability = useAbility();
  const canMutateMembership = ability.can(AbilityAction.Update, "UserMembership");
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const tenantId = authUser?.tenantId ?? "";
  const toast = useAppToast();
  const hintId = useId();
  const currentNorm = normalizeRole(rowRole);
  const statusNorm = rowStatus.trim().toUpperCase();
  const isSelf = isSelfTarget || (sessionUser?.userId ?? "") === rowId;
  const isOwner = isOwnerTarget || currentNorm === "owner";
  const resolved = resolveWorkspaceRoleSelectUi({
    actorUserId: sessionUser?.userId ?? "",
    actorRole: sessionUser?.role,
    targetUserId: rowId,
    targetRole: rowRole,
    normalizedCurrentRole: currentNorm
  });
  const rowMutationPending = activeRoleMutationUserId === rowId;
  const roleSelectDisabled =
    !canMutateMembership || rowMutationPending || resolved.disabledWithoutMutation;
  const hintText = useMemo(() => {
    if (rowMutationPending) return copy.roleSelectHintSaving;
    if (resolved.hintKey) return roleSelectHintForKey(resolved.hintKey);
    return null;
  }, [rowMutationPending, resolved.hintKey]);
  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(rowId),
    onSuccess: () => toast.success({ message: "User suspended." }),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to suspend user." }),
    onSettled: () => {
      if (tenantId) void queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) });
    }
  });
  const reactivateMutation = useMutation({
    mutationFn: () => reactivateUser(rowId),
    onSuccess: () => toast.success({ message: "User reactivated." }),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to reactivate user." }),
    onSettled: () => {
      if (tenantId) void queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) });
    }
  });
  const resendInviteMutation = useMutation({
    mutationFn: () => resendInvite(rowId),
    onSuccess: () => toast.success({ message: "Invite resent." }),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to resend invite." }),
    onSettled: () => {
      if (tenantId) void queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) });
    }
  });
  const removeMutation = useMutation({
    mutationFn: () => removeUser(rowId),
    onSuccess: () => toast.success({ message: "User removed from workspace." }),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to remove user." }),
    onSettled: () => {
      if (tenantId) void queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) });
    }
  });
  const lifecycleMutationPending =
    suspendMutation.isPending ||
    reactivateMutation.isPending ||
    resendInviteMutation.isPending ||
    removeMutation.isPending;
  const suspendDisabled = !canMutateMembership || lifecycleMutationPending || isSelf || isOwner;
  const reactivateDisabled = !canMutateMembership || lifecycleMutationPending || isSelf;
  const resendInviteDisabled = !canMutateMembership || lifecycleMutationPending || isSelf;
  const removeDisabled = !canMutateMembership || lifecycleMutationPending || isSelf || isOwner;

  return (
    <div className={styles.inlineActions}>
      <div className={styles.roleControl}>
        <Select
          aria-label={`Role for ${rowName}`}
          {...(roleSelectDisabled && hintText ? { "aria-describedby": hintId } : {})}
          title={roleSelectDisabled && hintText ? hintText : undefined}
          value={currentNorm}
          disabled={roleSelectDisabled}
          onChange={(e) => {
            roleMutation.mutate({ userId: rowId, role: e.target.value as UserRole });
          }}
        >
          {resolved.optionValues.map((r) => (
            <option key={r} value={r} disabled={r === currentNorm} aria-disabled={r === currentNorm}>
              {r === currentNorm ? `${roleLabel(r)} (current)` : roleLabel(r)}
            </option>
          ))}
        </Select>
        {roleSelectDisabled && hintText ? (
          <small id={hintId} className={styles.roleHint}>
            {hintText}
          </small>
        ) : null}
      </div>
      <Button type="button" variant="ghost" size="sm" aria-label={`${copy.viewDetailsButton}, ${rowName}`} onClick={onOpenProfile}>
        {copy.viewDetailsButton}
      </Button>
      {statusNorm === "ACTIVE" && !isOwner ? (
        <Button type="button" variant="ghost" size="sm" disabled={suspendDisabled} onClick={() => suspendMutation.mutate()}>
          Suspend user
        </Button>
      ) : null}
      {statusNorm === "SUSPENDED" ? (
        <Button type="button" variant="ghost" size="sm" disabled={reactivateDisabled} onClick={() => reactivateMutation.mutate()}>
          Reactivate user
        </Button>
      ) : null}
      {statusNorm === "INVITED" ? (
        <Button type="button" variant="ghost" size="sm" disabled={resendInviteDisabled} onClick={() => resendInviteMutation.mutate()}>
          Resend invite
        </Button>
      ) : null}
      {(statusNorm === "ACTIVE" || statusNorm === "SUSPENDED" || statusNorm === "INVITED") && !isOwner ? (
        <Button type="button" variant="ghost" size="sm" disabled={removeDisabled} onClick={() => removeMutation.mutate()}>
          Remove from workspace
        </Button>
      ) : null}
    </div>
  );
}
