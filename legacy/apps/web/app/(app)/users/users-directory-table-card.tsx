"use client";

import type { ReactNode } from "react";
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
import { DirectoryTabs, type DirectoryTabId } from "./components/directory-tabs";
import { UserFilters } from "./user-filters";
import { UserTable } from "./user-table";
import { USERS_ROUTE_COPY } from "./users-copy";
import styles from "./users-page.module.css";

const copy = USERS_ROUTE_COPY.list;

export type UsersDirectoryTableCardProps = {
  searchQuery: string;
  onSearchQueryChange: (_value: string) => void;
  roleFilter: RoleFilter;
  onRoleFilterChange: (_value: RoleFilter) => void;
  onClearFilters: () => void;
  onExportCsv: () => void;
  onInviteUser: () => void;
  exportDisabled: boolean;
  sortColumn: UserSortColumn;
  sortDir: UserSortDirection;
  onToggleSort: (_column: UserSortColumn) => void;
  rows: WorkspaceUserDto[];
  totalFilteredCount: number;
  hasMoreBelow: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  onRequestLoadMore: () => void;
  sessionUser: AuthUser | null;
  roleMutation: UseMutationResult<
    WorkspaceUserDto,
    unknown,
    { userId: string; role: UserRole },
    unknown
  >;
  activeRoleMutationUserId: string | null;
  onManageRewards?: (_user: WorkspaceUserDto) => void;
  directoryListQueryKey: readonly unknown[];
  directoryTab: DirectoryTabId;
  onDirectoryTabChange: (_tab: DirectoryTabId) => void;
  pendingPanel: ReactNode;
};

/** Card shell: toolbar, virtualized member table or “no matches”, load-more footer. */
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
  totalFilteredCount,
  hasMoreBelow,
  isLoadingMore,
  isRefreshing,
  onRequestLoadMore,
  sessionUser,
  roleMutation,
  activeRoleMutationUserId,
  onManageRewards,
  directoryListQueryKey,
  directoryTab,
  onDirectoryTabChange,
  pendingPanel,
}: UsersDirectoryTableCardProps) {
  return (
    <Card className={styles.directoryRtlRoot} dir="rtl">
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
      <DirectoryTabs
        activeTab={directoryTab}
        onTabChange={onDirectoryTabChange}
        activeLabel={copy.directoryTabActive}
        pendingLabel={copy.directoryTabPending}
      />
      <CardBody>
        {directoryTab === "pending" ? (
          pendingPanel
        ) : rows.length === 0 ? (
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
            hasMoreBelow={hasMoreBelow}
            onRequestLoadMore={onRequestLoadMore}
            onManageRewards={onManageRewards}
            directoryListQueryKey={directoryListQueryKey}
          />
        )}
      </CardBody>
      {directoryTab === "active" && rows.length > 0 ? (
        <CardFooter>
          <div className={styles.directoryFooter}>
            <div>
              <p className={styles.directoryFooterMeta}>
                <span aria-live="polite">
                  {`${totalFilteredCount} ${copy.directoryMembersWord}`}
                  {isLoadingMore ? ` — ${copy.loadingMoreUsersLabel}` : null}
                </span>
              </p>
              {hasMoreBelow ? (
                <p className={styles.directoryFooterMeta}>{copy.directoryMoreAvailableHint}</p>
              ) : null}
            </div>
            {hasMoreBelow ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isLoadingMore}
                disabled={isLoadingMore}
                onClick={onRequestLoadMore}
              >
                {copy.directoryLoadMoreButton}
              </Button>
            ) : null}
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
