"use client";

import type { UseMutationResult } from "@tanstack/react-query";

import { Button, Card, CardBody, CardFooter, CardHeader, EmptyState } from "@tour/ui";

import type { AuthUser } from "@/lib/auth/auth-context";
import type { WorkspaceUserDto } from "@/lib/services/users.service";
import type { UserRole } from "@/lib/auth/user-role";

import type {
  RoleFilter,
  UserSortColumn,
  UserSortDirection,
} from "./users-page-logic";
import { UserFilters } from "./user-filters";
import { UserTable } from "./user-table";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UsersDirectoryPagination } from "./users-directory-pagination";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryTableCardProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (value: RoleFilter) => void;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onInviteUser: () => void;
  exportDisabled: boolean;
  sortColumn: UserSortColumn;
  sortDir: UserSortDirection;
  onToggleSort: (column: UserSortColumn) => void;
  rows: WorkspaceUserDto[];
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasUnloadedPages: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenProfile: (userId: string) => void;
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

/** Card shell: toolbar, member table or “no matches”, pagination (client-side only). */
export function UsersDirectoryTableCard({
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  onClearFilters,
  onExportCsv,
  onInviteUser,
  exportDisabled,
  sortColumn,
  sortDir,
  onToggleSort,
  rows,
  currentPage,
  totalPages,
  totalUsers,
  hasUnloadedPages,
  isLoadingMore,
  isRefreshing,
  onPrevPage,
  onNextPage,
  onOpenProfile,
  sessionUser,
  roleMutation,
  activeRoleMutationUserId,
  selectedUserIds,
  onSelectedUserIdsChange,
}: UsersDirectoryTableCardProps) {
  return (
    <Card>
      <CardHeader>
        <UserFilters
          searchQuery={searchQuery}
          onSearchChange={onSearchQueryChange}
          roleFilter={roleFilter}
          onRoleFilterChange={onRoleFilterChange}
          onExportCsv={onExportCsv}
          onInviteUser={onInviteUser}
          exportDisabled={exportDisabled}
          isRefreshing={isRefreshing}
        />
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            title={copy.noResultsTitle}
            description={copy.noResultsDescription}
            action={
              <Button type="button" variant="secondary" onClick={onClearFilters}>
                {copy.clearFiltersButton}
              </Button>
            }
          />
        ) : (
          <UserTable
            rows={rows}
            sortColumn={sortColumn}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
            sessionUser={sessionUser}
            roleMutation={roleMutation}
            activeRoleMutationUserId={activeRoleMutationUserId}
            selectedUserIds={selectedUserIds}
            onOpenProfile={onOpenProfile}
            onSelectedUserIdsChange={onSelectedUserIdsChange}
          />
        )}
      </CardBody>
      {(totalPages > 1 || hasUnloadedPages) ? (
        <CardFooter>
          <UsersDirectoryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalUsers={totalUsers}
            hasUnloadedPages={hasUnloadedPages}
            isLoadingMore={isLoadingMore}
            onPrev={onPrevPage}
            onNext={onNextPage}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}
