"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";

import { UserTable } from "./user-table";
import type { UserSortColumn, UserSortDirection } from "./users-page-logic";

export type UsersDirectoryMemberTableProps = {
  rows: WorkspaceUserDto[];
  sortColumn: UserSortColumn;
  sortDir: UserSortDirection;
  onToggleSort: (column: UserSortColumn) => void;
  sessionUser: AuthUser | null;
  roleMutation: UseMutationResult<
    WorkspaceUserDto,
    unknown,
    { userId: string; role: UserRole },
    unknown
  >;
  activeRoleMutationUserId: string | null;
  selectedUserIds: ReadonlySet<string>;
  onSelectedUserIdsChange: (userIds: Set<string>) => void;
};

/**
 * Backward-compatible wrapper kept for gradual migration.
 * All table behavior now lives in the consolidated `UserTable`.
 */
export function UsersDirectoryMemberTable({
  rows,
  sortColumn,
  sortDir,
  onToggleSort,
  sessionUser,
  roleMutation,
  activeRoleMutationUserId,
  selectedUserIds,
  onSelectedUserIdsChange
}: UsersDirectoryMemberTableProps) {
  const router = useRouter();
  return (
    <UserTable
      rows={rows}
      sortColumn={sortColumn}
      sortDir={sortDir}
      onToggleSort={onToggleSort}
      sessionUser={sessionUser}
      roleMutation={roleMutation}
      activeRoleMutationUserId={activeRoleMutationUserId}
      selectedUserIds={selectedUserIds}
      onSelectedUserIdsChange={onSelectedUserIdsChange}
      onOpenProfile={(userId) => router.push(`/users/${userId}`)}
    />
  );
}
