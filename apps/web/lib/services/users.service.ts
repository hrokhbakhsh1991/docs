import { NotFoundError } from "@/lib/api-client";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";
import { UserRole } from "../auth/user-role";

/** Lists/updates users via same-origin BFF `/api/users`. */
export function usersUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

/**
 * Tenant directory row from `GET /api/v2/users` → `UserResponseDto`.
 */
export type WorkspaceUserDto = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isPhoneVerified?: boolean;
  role: UserRole;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | string;
  lastLoginAt?: string | null;
  joinedAt?: string | null;
  invitedAt?: string | null;
  suspendedAt?: string | null;
  labels?: string[];
  permanentDiscountPercentage?: number;
  rewardBadges?: string[];
  isSelectableLeader?: boolean;
  telegramLinked?: boolean;
  gender?: "female" | "male" | "non_binary" | "prefer_not_to_say" | null;
  profileImageUrl?: string | null;
  lastActiveAt?: string | null;
  walletBalanceMinor?: string;
  walletCurrency?: string;
  totalTrips?: number;
  completedTrips?: number;
  cancelledTrips?: number;
};

export type PatchMembershipCapabilitiesPayload = {
  capabilities: string[];
  allowedRegionIds?: string[];
};

export type UserRoleHistoryItemDto = {
  actorUserId: string;
  actorEmail: string;
  oldRole: string;
  newRole: string;
  createdAt: string;
};

export type GetUsersParams = {
  limit?: number;
  cursor?: string;
  search?: string;
  role?: UserRole;
  status?: "INVITED" | "ACTIVE" | "SUSPENDED";
  lastLoginFrom?: string;
  lastLoginTo?: string;
};

export type GetUsersResponseDto = {
  data: WorkspaceUserDto[];
  nextCursor: string | null;
};

export async function getUsers(params?: GetUsersParams): Promise<GetUsersResponseDto> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.role) query.set("role", params.role);
  if (params?.status) query.set("status", params.status);
  if (params?.lastLoginFrom?.trim()) query.set("lastLoginFrom", params.lastLoginFrom.trim());
  if (params?.lastLoginTo?.trim()) query.set("lastLoginTo", params.lastLoginTo.trim());
  return bffBrowserClient.get<GetUsersResponseDto>(BFF.usersQuery(query.toString()));
}

export async function getUserById(id: string): Promise<WorkspaceUserDto | null> {
  try {
    return await bffBrowserClient.get<WorkspaceUserDto>(BFF.user(id));
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      return null;
    }
    throw err;
  }
}

export type InvitableWorkspaceRole = UserRole.Admin | UserRole.Member | UserRole.Viewer;

export type InviteUserPayload = {
  phone: string;
  role: InvitableWorkspaceRole;
};

export async function inviteUser(payload: InviteUserPayload): Promise<unknown> {
  return bffBrowserClient.post(BFF.usersInvite, payload);
}

export async function resendInvite(userId: string): Promise<unknown> {
  return bffBrowserClient.post(BFF.userAction(userId, "resend-invite"), {});
}

/**
 * Handlers for {@link withOptimisticUsersRollback}: capture list state, patch UI/cache, restore on failure.
 */
export type OptimisticUsersRollbackHandlers<TSnapshot, TData> = {
  snapshot: () => TSnapshot;
  applyOptimistic: (snapshot: TSnapshot) => void;
  rollback: (snapshot: TSnapshot) => void;
  onSuccess?: (data: TData) => void;
};

/**
 * Runs `snapshot` → `applyOptimistic` → async `run`; on rejection calls `rollback` with the same snapshot
 * so the UI does not stay optimistically wrong after a failed users-directory mutation.
 */
export async function withOptimisticUsersRollback<TData, TSnapshot>(
  run: () => Promise<TData>,
  handlers: OptimisticUsersRollbackHandlers<TSnapshot, TData>,
): Promise<TData> {
  const snapshot = handlers.snapshot();
  handlers.applyOptimistic(snapshot);
  try {
    const data = await run();
    handlers.onSuccess?.(data);
    return data;
  } catch (err) {
    handlers.rollback(snapshot);
    throw err;
  }
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  optimistic?: OptimisticUsersRollbackHandlers<unknown, WorkspaceUserDto>,
): Promise<WorkspaceUserDto> {
  const run = () => bffBrowserClient.patch<WorkspaceUserDto>(BFF.user(id), { role });
  if (!optimistic) {
    return run();
  }
  return withOptimisticUsersRollback(run, optimistic);
}

export type BulkPatchWorkspaceRole =
  | UserRole.Leader
  | UserRole.Admin
  | UserRole.Member
  | UserRole.Viewer;

export async function bulkUpdateUserRole(
  userIds: string[],
  role: BulkPatchWorkspaceRole,
  optimistic?: OptimisticUsersRollbackHandlers<unknown, WorkspaceUserDto[]>,
): Promise<WorkspaceUserDto[]> {
  const run = () =>
    bffBrowserClient.patch<WorkspaceUserDto[]>(BFF.usersBulkRole, {
      userIds,
      role,
    });
  if (!optimistic) {
    return run();
  }
  return withOptimisticUsersRollback(run, optimistic);
}

/** Backward-compatible alias used by existing callers. */
export const bulkUpdateUsersRole = bulkUpdateUserRole;

export async function suspendUser(userId: string): Promise<WorkspaceUserDto> {
  return bffBrowserClient.patch<WorkspaceUserDto>(BFF.userAction(userId, "suspend"), {});
}

export async function reactivateUser(userId: string): Promise<WorkspaceUserDto> {
  return bffBrowserClient.patch<WorkspaceUserDto>(BFF.userAction(userId, "reactivate"), {});
}

export async function removeUser(userId: string): Promise<{ success: true } | void> {
  return bffBrowserClient.delete(BFF.userAction(userId, "remove"));
}

export async function getUserRoleHistory(id: string): Promise<UserRoleHistoryItemDto[]> {
  return bffBrowserClient.get<UserRoleHistoryItemDto[]>(BFF.userAction(id, "role-history"));
}

export async function patchMembershipCapabilities(
  tenantId: string,
  userId: string,
  payload: PatchMembershipCapabilitiesPayload,
): Promise<WorkspaceUserDto> {
  return bffBrowserClient.patch<WorkspaceUserDto>(
    BFF.workspaceUserCapabilities(tenantId, userId),
    payload,
  );
}

export async function bulkSuspendUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => suspendUser(id)));
}

export async function bulkReactivateUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => reactivateUser(id)));
}

export async function bulkRemoveUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((id) => removeUser(id)));
}
