import { apiClient } from "../api-client";
import { API } from "../api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";
import type { UserRole } from "../auth/user-role";

/** When true, list/update users against Tour-Ops API (`NEXT_PUBLIC_API_URL`). */
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
  telegramLinked?: boolean;
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
  const queryString = query.toString();
  const path = queryString ? `${API.users}?${queryString}` : API.users;
  return apiClient.get<GetUsersResponseDto>(path);
}

export async function getUserById(id: string): Promise<WorkspaceUserDto | null> {
  return apiClient.get<WorkspaceUserDto>(API.user(id));
}

export type InviteUserPayload = {
  phone: string;
  role: Extract<UserRole, "admin" | "member" | "viewer">;
};

export async function inviteUser(payload: InviteUserPayload): Promise<unknown> {
  return apiClient.post(`${API.users}/invite`, payload);
}

export async function resendInvite(userId: string): Promise<unknown> {
  return apiClient.post(`${API.user(userId)}/resend-invite`, {});
}

export async function updateUserRole(id: string, role: UserRole): Promise<WorkspaceUserDto> {
  return apiClient.patch<WorkspaceUserDto>(API.user(id), {
    role
  });
}

export async function bulkUpdateUserRole(
  userIds: string[],
  role: Extract<UserRole, "leader" | "admin" | "member" | "viewer">
): Promise<WorkspaceUserDto[]> {
  return apiClient.patch<WorkspaceUserDto[]>(API.usersBulkRole, {
    userIds,
    role,
  });
}

export type OptimisticUsersMutationCallbacks<T> = {
  onSuccess?: (data: T) => void;
  /** Invoked when the API call fails after an optimistic UI patch (e.g. TanStack Query `onError`). */
  onRollback?: () => void;
};

/**
 * Phase 1 stub: wraps a users-directory mutation so callers can centralize rollback hooks.
 * Phase 2+: pair with TanStack Query `onMutate` snapshot restore for the users list cache.
 */
export async function withOptimisticUsersRollback<T>(
  run: () => Promise<T>,
  callbacks?: OptimisticUsersMutationCallbacks<T>
): Promise<T> {
  try {
    const data = await run();
    callbacks?.onSuccess?.(data);
    return data;
  } catch (err) {
    callbacks?.onRollback?.();
    throw err;
  }
}

/** Wraps {@link updateUserRole} with {@link withOptimisticUsersRollback} for directory mutations. */
export function updateUserRoleWithOptimisticUsersRollback(
  id: string,
  role: UserRole,
  callbacks?: OptimisticUsersMutationCallbacks<WorkspaceUserDto>
): Promise<WorkspaceUserDto> {
  return withOptimisticUsersRollback(() => updateUserRole(id, role), callbacks);
}

/** Wraps {@link bulkUpdateUserRole} with rollback hooks. */
export function bulkUpdateUserRoleWithOptimisticUsersRollback(
  userIds: string[],
  role: Extract<UserRole, "leader" | "admin" | "member" | "viewer">,
  callbacks?: OptimisticUsersMutationCallbacks<WorkspaceUserDto[]>
): Promise<WorkspaceUserDto[]> {
  return withOptimisticUsersRollback(() => bulkUpdateUserRole(userIds, role), callbacks);
}

/** Backward-compatible alias used by existing callers. */
export const bulkUpdateUsersRole = bulkUpdateUserRole;

export async function suspendUser(userId: string): Promise<WorkspaceUserDto> {
  return apiClient.patch<WorkspaceUserDto>(`${API.user(userId)}/suspend`);
}

export async function reactivateUser(userId: string): Promise<WorkspaceUserDto> {
  return apiClient.patch<WorkspaceUserDto>(`${API.user(userId)}/reactivate`);
}

export async function removeUser(userId: string): Promise<{ success: true } | void> {
  return apiClient.delete(`${API.user(userId)}/remove`);
}

export async function getUserRoleHistory(id: string): Promise<UserRoleHistoryItemDto[]> {
  return apiClient.get<UserRoleHistoryItemDto[]>(API.userRoleHistory(id));
}
