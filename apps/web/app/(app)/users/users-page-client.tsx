"use client";

import {
  keepPreviousData,
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isLeaderRole, isWorkspaceOwner, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import {
  getUsers,
  type GetUsersResponseDto,
  listPendingInvites,
  updateUserRole,
  usersUseLiveApi,
  type WorkspaceUserDto,
} from "@/lib/services/users.service";
import { patchWorkspaceUserRole } from "@/shared/api/workspace-users.client";
import { UserRole } from "@/lib/auth/user-role";
import { tryParseWorkspaceRole } from "@repo/shared";
import { useAppToast } from "@/lib/use-app-toast";

import {
  createDefaultDirectoryListUiState,
  type DirectoryListUiState,
} from "./users-directory-ui-state";
import {
  sortUsers,
  type RoleFilter,
  type UserSortColumn,
} from "./users-page-logic";
import { USERS_ROUTE_COPY } from "./users-copy";
import type { DirectoryTabId } from "./components/directory-tabs";
import { PendingInvitesTable } from "./components/pending-invites-table";
import { WorkspaceInviteModal } from "./components/workspace-invite-modal";
import { WorkspaceUserRewardsModal } from "./components/workspace-user-rewards-modal";
import { UsersDirectoryLockedPanel } from "./users-directory-locked-panel";
import { UsersDirectoryTableCard } from "./users-directory-table-card";
import { resolveUsersDirectoryBodyState } from "./users-directory-gate";
import { UsersDirectoryPageShell } from "./users-page-shell";

const copy = USERS_ROUTE_COPY.list;
const ROLE_FILTER_VALUES: readonly RoleFilter[] = [
  "all",
  UserRole.Owner,
  UserRole.Leader,
  UserRole.Admin,
  UserRole.Member,
  UserRole.Viewer
];
/** Matches `GET /api/v2/users` page size and React Query `directoryList` key segment. */
const DIRECTORY_FETCH_LIMIT = 50;

function parseSortParam(value: string | null): { sortColumn: UserSortColumn; sortDir: "asc" | "desc" } {
  switch ((value ?? "").trim().toLowerCase()) {
    case "name_desc":
      return { sortColumn: "name", sortDir: "desc" };
    case "email_asc":
      return { sortColumn: "email", sortDir: "asc" };
    case "email_desc":
      return { sortColumn: "email", sortDir: "desc" };
    case "name_asc":
    default:
      return { sortColumn: "name", sortDir: "asc" };
  }
}

function parseRoleParam(value: string | null): RoleFilter {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "" || raw === "all") {
    return "all";
  }
  const parsed = tryParseWorkspaceRole(raw);
  if (parsed && ROLE_FILTER_VALUES.includes(parsed)) {
    return parsed;
  }
  return "all";
}

export function UsersPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user: sessionUser } = useAuth();
  const liveApi = usersUseLiveApi();
  const leader = isLeaderRole(sessionUser?.role);
  const listQueryEnabled = liveApi && isHydrated && isAuthenticated && leader;
  const initialQuerySearch = (searchParams.get("search") ?? "").trim();
  const initialQueryRole = parseRoleParam(searchParams.get("role"));
  /** Filter / sort controls — initialized from URL. */
  const [directoryUiState, setDirectoryUiState] = useState<DirectoryListUiState>(() => {
    const defaults = createDefaultDirectoryListUiState();
    const sort = parseSortParam(searchParams.get("sort"));
    return {
      ...defaults,
      searchQuery: initialQuerySearch,
      roleFilter: initialQueryRole,
      sortColumn: sort.sortColumn,
      sortDir: sort.sortDir,
    };
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(initialQuerySearch);
  const [directoryTab, setDirectoryTab] = useState<DirectoryTabId>("active");
  const [inviteUserModalOpen, setInviteUserModalOpen] = useState(false);
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);
  const [rewardsModalUser, setRewardsModalUser] = useState<WorkspaceUserDto | null>(null);

  const activeSearchQuery = debouncedSearchQuery.trim();
  const activeRoleFilter = directoryUiState.roleFilter === "all" ? undefined : directoryUiState.roleFilter;
  const tenantId = sessionUser?.tenantId ?? "";
  const userListQueryKey = useMemo(
    () =>
      tenantId
        ? userKeys.directoryList(tenantId, {
            search: activeSearchQuery,
            role: activeRoleFilter ?? "all",
            limit: DIRECTORY_FETCH_LIMIT,
            status: "ACTIVE",
          })
        : ([...userKeys.all, "list", "__no-tenant__"] as const),
    [tenantId, activeSearchQuery, activeRoleFilter],
  );

  const pendingInvitesQueryKey = useMemo(
    () => (tenantId ? userKeys.pendingInvites(tenantId) : ([...userKeys.all, "pending-invites", "__no-tenant__"] as const)),
    [tenantId],
  );

  const {
    data,
    isPending: usersLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: userListQueryKey,
    queryFn: ({ pageParam }) =>
      getUsers({
        limit: DIRECTORY_FETCH_LIMIT,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
        search: activeSearchQuery || undefined,
        role: activeRoleFilter,
        status: "ACTIVE",
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: listQueryEnabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const rosterRows = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.data),
    [data?.pages],
  );
  const hasNextPage = Boolean(data?.pages?.at(-1)?.nextCursor);
  const usersLoadingInitial = usersLoading && rosterRows.length === 0;

  const {
    data: pendingInvitesData,
    isPending: pendingInvitesLoading,
    isError: pendingInvitesError,
  } = useQuery({
    queryKey: pendingInvitesQueryKey,
    queryFn: listPendingInvites,
    enabled: listQueryEnabled && directoryTab === "pending",
    staleTime: 15_000,
  });

  const pendingInviteRows = pendingInvitesData?.data ?? [];

  const [activeRoleMutationUserId, setActiveRoleMutationUserId] = useState<string | null>(null);
  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      setActiveRoleMutationUserId(userId);
      await queryClient.cancelQueries({ queryKey: userListQueryKey });
      const queryKey = userListQueryKey;
      const optimistic = {
        snapshot: () => queryClient.getQueryData<InfiniteData<GetUsersResponseDto>>(queryKey),
        applyOptimistic: (_snapshot: unknown) => {
          queryClient.setQueryData<InfiniteData<GetUsersResponseDto>>(queryKey, (current) => {
            if (!current) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                data: page.data.map((row) =>
                  row.id === userId
                    ? {
                        ...row,
                        role,
                      }
                    : row,
                ),
              })),
            };
          });
        },
        rollback: (previous: unknown) => {
          if (previous !== undefined) {
            queryClient.setQueryData(queryKey, previous);
          }
        },
      };
      if (sessionUser && isWorkspaceOwner(sessionUser.role)) {
        return patchWorkspaceUserRole(userId, role, optimistic);
      }
      return updateUserRole(userId, role, optimistic);
    },
    onSuccess: () => {
      toast.success({ message: copy.roleUpdatedToast });
    },
    onError: (e: unknown) => {
      toast.error({
        message: e instanceof ApiError ? e.message : copy.roleUpdateErrorToast,
      });
    },
    onSettled: () => {
      setActiveRoleMutationUserId(null);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(directoryUiState.searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [directoryUiState.searchQuery]);

  const updateQueryParams = useCallback((next: DirectoryListUiState, searchOverride?: string) => {
    const params = new URLSearchParams();
    const normalizedSearch = (searchOverride ?? next.searchQuery).trim();
    if (normalizedSearch) params.set("search", normalizedSearch);
    if (next.roleFilter !== "all") params.set("role", next.roleFilter);
    const sortToken = `${next.sortColumn}_${next.sortDir}`;
    if (sortToken !== "name_asc") params.set("sort", sortToken);
    const query = params.toString();
    router.replace(query ? `/users?${query}` : "/users", { scroll: false });
  }, [router]);

  const updateDirectoryUiState = useCallback((patch: Partial<DirectoryListUiState>) => {
    setDirectoryUiState((s) => ({ ...s, ...patch }));
  }, []);

  useEffect(() => {
    updateQueryParams(directoryUiState, debouncedSearchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearchQuery,
    directoryUiState.roleFilter,
    directoryUiState.sortColumn,
    directoryUiState.sortDir,
  ]);

  const sortedUsers = useMemo(
    () =>
      sortUsers(rosterRows, {
        sortColumn: directoryUiState.sortColumn,
        sortDir: directoryUiState.sortDir,
      }),
    [rosterRows, directoryUiState.sortColumn, directoryUiState.sortDir],
  );

  const toggleUserSort = useCallback((column: UserSortColumn) => {
    setDirectoryUiState((s) => {
      if (s.sortColumn !== column) {
        return { ...s, sortColumn: column, sortDir: "asc" };
      }
      const nextSortDir: DirectoryListUiState["sortDir"] = s.sortDir === "asc" ? "desc" : "asc";
      return { ...s, sortDir: nextSortDir };
    });
  }, []);

  const requestMoreMembers = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openInviteUserModal = useCallback(() => {
    setInviteUserModalOpen(true);
  }, []);

  const handleInviteUserModalClose = useCallback(() => {
    setInviteUserModalOpen(false);
  }, []);

  const refreshDirectoryQueries = useCallback(async () => {
    if (!tenantId) {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.directoryListRoot(tenantId) }),
      queryClient.invalidateQueries({ queryKey: pendingInvitesQueryKey }),
    ]);
  }, [queryClient, tenantId, pendingInvitesQueryKey]);

  const refreshUsersListAfterInvite = useCallback(async () => {
    await refreshDirectoryQueries();
    setDirectoryTab("pending");
  }, [refreshDirectoryQueries]);

  const bodyState = resolveUsersDirectoryBodyState({
    isHydrated,
    isAuthenticated,
    leader,
    liveApi,
    usersLoading: usersLoadingInitial,
    isError,
    error,
    usersLength: rosterRows.length,
    hasActiveFilters:
      debouncedSearchQuery.trim().length > 0 || directoryUiState.roleFilter !== "all",
  });

  const clearDirectoryFilters = useCallback(() => {
    setDirectoryUiState((s) => ({
      ...s,
      searchQuery: "",
      roleFilter: "all"
    }));
    setDebouncedSearchQuery("");
  }, []);

  const openRewardsModal = useCallback((user: WorkspaceUserDto) => {
    setRewardsModalUser(user);
    setRewardsModalOpen(true);
  }, []);

  const closeRewardsModal = useCallback(() => {
    setRewardsModalOpen(false);
    setRewardsModalUser(null);
  }, []);

  const refreshUsersListAfterRewards = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: userListQueryKey });
  }, [queryClient, userListQueryKey]);

  const exportUsersCsv = useCallback(() => {
    const headers = [...copy.exportCsvHeaders];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
    const lines = [headers.join(",")];
    for (const row of sortedUsers) {
      const labelsJoined = (row.labels ?? []).join("; ");
      lines.push(
        [
          escapeCsv(row.name),
          escapeCsv(row.email ?? ""),
          escapeCsv(row.role),
          escapeCsv(row.status),
          escapeCsv(labelsJoined),
          escapeCsv(row.telegramLinked ? copy.exportCsvYes : copy.exportCsvNo),
        ].join(","),
      );
    }
    const csv = `${lines.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `users-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success({
      message: copy.exportCsvSuccessToast.replace("{n}", String(sortedUsers.length)),
    });
  }, [sortedUsers, toast]);

  return (
    <UsersDirectoryPageShell>
      {bodyState.type === "directory" ? (
        <>
          <UsersDirectoryTableCard
            searchQuery={directoryUiState.searchQuery}
            onSearchQueryChange={(value) => updateDirectoryUiState({ searchQuery: value })}
            roleFilter={directoryUiState.roleFilter}
            onRoleFilterChange={(value) => updateDirectoryUiState({ roleFilter: value })}
            onClearFilters={clearDirectoryFilters}
            onExportCsv={exportUsersCsv}
            onInviteUser={openInviteUserModal}
            exportDisabled={sortedUsers.length === 0}
            sortColumn={directoryUiState.sortColumn}
            sortDir={directoryUiState.sortDir}
            onToggleSort={toggleUserSort}
            rows={sortedUsers}
            totalFilteredCount={sortedUsers.length}
            hasMoreBelow={hasNextPage}
            isLoadingMore={isFetchingNextPage}
            isRefreshing={isFetching && !usersLoadingInitial}
            onRequestLoadMore={requestMoreMembers}
            sessionUser={sessionUser}
            roleMutation={roleMutation}
            activeRoleMutationUserId={activeRoleMutationUserId}
            onManageRewards={isLeaderRole(sessionUser?.role) ? openRewardsModal : undefined}
            directoryListQueryKey={userListQueryKey}
            directoryTab={directoryTab}
            onDirectoryTabChange={setDirectoryTab}
            pendingPanel={
              <PendingInvitesTable
                rows={pendingInviteRows}
                isLoading={pendingInvitesLoading}
                isError={pendingInvitesError}
                onRefresh={refreshDirectoryQueries}
              />
            }
          />
          <WorkspaceInviteModal
            open={inviteUserModalOpen}
            onClose={handleInviteUserModalClose}
            onInvited={refreshUsersListAfterInvite}
          />
          <WorkspaceUserRewardsModal
            open={rewardsModalOpen}
            user={rewardsModalUser}
            onClose={closeRewardsModal}
            onSaved={refreshUsersListAfterRewards}
          />
        </>
      ) : (
        <UsersDirectoryLockedPanel state={bodyState} onRetryList={() => void refetch()} />
      )}
    </UsersDirectoryPageShell>
  );
}
