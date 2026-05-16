"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, FormField, Select } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import { UserRole } from "@/lib/auth/user-role";
import { userKeys } from "@/lib/query-keys";
import {
  reactivateUser,
  removeUser,
  resendInvite,
  suspendUser,
  updateUserRole,
} from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

type AssignableRole = "admin" | "member" | "viewer";

type UserAdminActionsCardProps = {
  userId: string;
  tenantScope: string;
  currentRole: string;
  currentStatus: string;
  sessionUserId?: string;
  onChanged?: () => void | Promise<void>;
};

function normalizeStatus(status: string): "INVITED" | "ACTIVE" | "SUSPENDED" | "UNKNOWN" {
  const value = status.trim().toUpperCase();
  if (value === "INVITED") return "INVITED";
  if (value === "ACTIVE") return "ACTIVE";
  if (value === "SUSPENDED") return "SUSPENDED";
  return "UNKNOWN";
}

export function UserAdminActionsCard({
  userId,
  tenantScope,
  currentRole,
  currentStatus,
  sessionUserId,
  onChanged,
}: UserAdminActionsCardProps): JSX.Element {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const normalizedStatus = normalizeStatus(currentStatus);
  const isSelfTarget = (sessionUserId ?? "") === userId;
  const isOwnerTarget = currentRole.trim().toLowerCase() === "owner";

  async function afterSuccess(message: string) {
    toast.success({ message });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantScope) }),
      queryClient.invalidateQueries({ queryKey: userKeys.detail(tenantScope, userId) }),
      queryClient.invalidateQueries({ queryKey: userKeys.roleHistory(tenantScope, userId) }),
    ]);
    if (onChanged) await onChanged();
  }

  const changeRoleMutation = useMutation({
    mutationFn: (role: AssignableRole) => updateUserRole(userId, role as UserRole),
    onSuccess: () => void afterSuccess("Role updated."),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to update role." }),
  });

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(userId),
    onSuccess: () => void afterSuccess("User suspended."),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to suspend user." }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateUser(userId),
    onSuccess: () => void afterSuccess("User reactivated."),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to reactivate user." }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: () => resendInvite(userId),
    onSuccess: () => void afterSuccess("Invite resent."),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to resend invite." }),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeUser(userId),
    onSuccess: () => void afterSuccess("User removed from workspace."),
    onError: (e: unknown) =>
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to remove user." }),
  });

  const isBusy =
    changeRoleMutation.isPending ||
    suspendMutation.isPending ||
    reactivateMutation.isPending ||
    resendInviteMutation.isPending ||
    removeMutation.isPending;
  const roleChangeDisabled = isBusy || isSelfTarget;
  const suspendDisabled = isBusy || isSelfTarget || isOwnerTarget;
  const reactivateDisabled = isBusy || isSelfTarget;
  const resendInviteDisabled = isBusy || isSelfTarget;
  const removeDisabled = isBusy || isSelfTarget || isOwnerTarget;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Actions</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gap: 12 }}>
          <FormField label="Change role">
            {isOwnerTarget ? (
              <Badge variant="neutral">Owner</Badge>
            ) : (
              <Select
                value={currentRole.trim().toLowerCase()}
                disabled={roleChangeDisabled}
                onChange={(e) => {
                  changeRoleMutation.mutate(e.target.value as AssignableRole);
                }}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </Select>
            )}
          </FormField>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {normalizedStatus === "ACTIVE" && !isOwnerTarget ? (
              <Button type="button" variant="secondary" disabled={suspendDisabled} onClick={() => suspendMutation.mutate()}>
                Suspend user
              </Button>
            ) : null}

            {normalizedStatus === "SUSPENDED" ? (
              <Button type="button" variant="secondary" disabled={reactivateDisabled} onClick={() => reactivateMutation.mutate()}>
                Reactivate user
              </Button>
            ) : null}

            {normalizedStatus === "INVITED" ? (
              <Button type="button" variant="secondary" disabled={resendInviteDisabled} onClick={() => resendInviteMutation.mutate()}>
                Resend invite
              </Button>
            ) : null}

            {!isOwnerTarget &&
            (normalizedStatus === "ACTIVE" ||
              normalizedStatus === "SUSPENDED" ||
              normalizedStatus === "INVITED") ? (
              <Button type="button" variant="ghost" disabled={removeDisabled} onClick={() => removeMutation.mutate()}>
                Remove user
              </Button>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

