"use client";

import {
  keepPreviousData,
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Modal } from "@tour/ui";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { API } from "@/lib/api-paths";
import { ApiError } from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import {
  getUsers,
  bulkUpdateUsersRole,
  type GetUsersResponseDto,
  updateUserRole,
  usersUseLiveApi,
} from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import {
  createDefaultDirectoryListUiState,
  type DirectoryListUiState,
} from "./users-directory-ui-state";
import {
  filterUsers,
  normalizeRole,
  sortUsers,
  type RoleFilter,
  type UserSortColumn,
} from "./users-page-logic";
import { USERS_ROUTE_COPY } from "./users-copy";
import { UsersDirectoryBulkToolbar, type BulkAssignableRole } from "./users-directory-bulk-toolbar";
import { InviteUserModal } from "./components/invite-user-modal";
import { UsersDirectoryLockedPanel } from "./users-directory-locked-panel";
import { UsersDirectoryTableCard } from "./users-directory-table-card";
import { resolveUsersDirectoryBodyState } from "./users-directory-gate";
import { UsersDirectoryPageShell } from "./users-page-shell";

const copy = USERS_ROUTE_COPY.list;
const ROLE_FILTER_VALUES: readonly RoleFilter[] = ["all", "owner", "admin", "member", "viewer"];
const USERS_PAGE_SIZE = 10;

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
  const candidate = (value ?? "").trim().toLowerCase() as RoleFilter;
  return ROLE_FILTER_VALUES.includes(candidate) ? candidate : "all";
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
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const [bulkRoleSelection, setBulkRoleSelection] = useState<"" | BulkAssignableRole>("");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [inviteUserModalOpen, setInviteUserModalOpen] = useState(false);
  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);

  const activeSearchQuery = debouncedSearchQuery.trim();
  const activeRoleFilter = directoryUiState.roleFilter === "all" ? undefined : directoryUiState.roleFilter;
  const userListQueryKey = useMemo(
    () => [
      ...userKeys.lists(),
      {
        tenantId: sessionUser?.tenantId ?? "anonymous",
        search: activeSearchQuery,
        role: activeRoleFilter
      }
    ],
    [sessionUser?.tenantId, activeSearchQuery, activeRoleFilter]
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
        limit: 30,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
        search: activeSearchQuery || undefined,
        role: activeRoleFilter,
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

  const [activeRoleMutationUserId, setActiveRoleMutationUserId] = useState<string | null>(null);
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onMutate: async (variables) => {
      setActiveRoleMutationUserId(variables.userId);
      await queryClient.cancelQueries({ queryKey: userKeys.lists() });
      const queryKey = userListQueryKey;
      const previous = queryClient.getQueryData<InfiniteData<GetUsersResponseDto>>(queryKey);
      queryClient.setQueryData<InfiniteData<GetUsersResponseDto>>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            data: page.data.map((row) =>
              row.id === variables.userId
                ? {
                    ...row,
                    role: variables.role,
                  }
                : row,
            ),
          })),
        };
      });
      return { previous, queryKey };
    },
    onSuccess: () => {
      toast.success({ message: copy.roleUpdatedToast });
    },
    onError: (e: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error({
        message: e instanceof ApiError ? e.message : copy.roleUpdateErrorToast,
      });
    },
    onSettled: (_data, _error, _vars, context) => {
      setActiveRoleMutationUserId(null);
      void queryClient.invalidateQueries({ queryKey: context?.queryKey ?? userKeys.lists() });
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(directoryUiState.searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [directoryUiState.searchQuery]);

  useEffect(() => {
    const rosterIdSet = new Set(rosterRows.map((row) => row.id));
    setSelectedUserIds((current) => {
      const next = new Set<string>();
      for (const userId of current) {
        if (rosterIdSet.has(userId)) next.add(userId);
      }
      return next;
    });
  }, [rosterRows]);

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

  const normalizedSearchQuery = useMemo(
    () => directoryUiState.searchQuery.trim().toLowerCase(),
    [directoryUiState.searchQuery],
  );

  const filteredUsers = useMemo(() => {
    return filterUsers(rosterRows, {
      roleFilter: directoryUiState.roleFilter,
      queryNorm: normalizedSearchQuery,
    });
  }, [rosterRows, directoryUiState.roleFilter, normalizedSearchQuery]);

  const sortedUsers = useMemo(() => {
    return sortUsers(filteredUsers, {
      sortColumn: directoryUiState.sortColumn,
      sortDir: directoryUiState.sortDir,
    });
  }, [
    filteredUsers,
    directoryUiState.sortColumn,
    directoryUiState.sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / USERS_PAGE_SIZE));
  const hasUnloadedPages = hasNextPage;
  const pageStart = (directoryPage - 1) * USERS_PAGE_SIZE;
  const pageEnd = pageStart + USERS_PAGE_SIZE;
  const pagedUsers = useMemo(
    () => sortedUsers.slice(pageStart, pageEnd),
    [sortedUsers, pageStart, pageEnd],
  );

  const selectableUserIds = useMemo(() => {
    const sessionUserId = sessionUser?.userId ?? "";
    return new Set(
      sortedUsers
        .filter((row) => normalizeRole(row.role) !== "owner" && row.id !== sessionUserId)
        .map((row) => row.id),
    );
  }, [sortedUsers, sessionUser?.userId]);

  useEffect(() => {
    setSelectedUserIds((current) => {
      const next = new Set<string>();
      for (const userId of current) {
        if (selectableUserIds.has(userId)) next.add(userId);
      }
      return next;
    });
  }, [selectableUserIds]);

  useEffect(() => {
    if (selectedUserIds.size === 0) {
      setBulkRoleSelection("");
    }
  }, [selectedUserIds.size]);

  useEffect(() => {
    setDirectoryPage(1);
  }, [debouncedSearchQuery, directoryUiState.roleFilter, directoryUiState.sortColumn, directoryUiState.sortDir]);

  useEffect(() => {
    setDirectoryPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const toggleUserSort = useCallback((column: UserSortColumn) => {
    setDirectoryUiState((s) => {
      if (s.sortColumn !== column) {
        return { ...s, sortColumn: column, sortDir: "asc" };
      }
      const nextSortDir: DirectoryListUiState["sortDir"] = s.sortDir === "asc" ? "desc" : "asc";
      return { ...s, sortDir: nextSortDir };
    });
  }, []);

  const bulkRoleMutation = useMutation({
    mutationFn: ({ userIds, role }: { userIds: string[]; role: BulkAssignableRole }) =>
      bulkUpdateUsersRole(userIds, role),
    onSuccess: (_result, variables) => {
      toast.success({ message: `Updated ${variables.userIds.length} users.` });
      setSelectedUserIds(new Set());
      setBulkRoleSelection("");
    },
    onError: (e: unknown) => {
      toast.error({
        message: e instanceof ApiError ? e.message : copy.roleUpdateErrorToast,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });

  const applyBulkRoleChange = useCallback(() => {
    if (!bulkRoleSelection || selectedUserIds.size === 0) return;
    bulkRoleMutation.mutate({
      userIds: [...selectedUserIds],
      role: bulkRoleSelection,
    });
  }, [bulkRoleSelection, selectedUserIds, bulkRoleMutation]);

  const bulkSuspendMutation = useMutation({
    mutationFn: async ({ userIds }: { userIds: string[] }) => {
      await Promise.all(userIds.map((id) => apiClient.patch(`${API.user(id)}/suspend`)));
    },
    onSuccess: (_result, variables) => {
      toast.success({ message: `Suspended ${variables.userIds.length} users.` });
      setSelectedUserIds(new Set());
    },
    onError: (e: unknown) => {
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to suspend selected users." });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });

  const bulkReactivateMutation = useMutation({
    mutationFn: async ({ userIds }: { userIds: string[] }) => {
      await Promise.all(userIds.map((id) => apiClient.patch(`${API.user(id)}/reactivate`)));
    },
    onSuccess: (_result, variables) => {
      toast.success({ message: `Reactivated ${variables.userIds.length} users.` });
      setSelectedUserIds(new Set());
    },
    onError: (e: unknown) => {
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to reactivate selected users." });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });

  const applyBulkSuspend = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    bulkSuspendMutation.mutate({ userIds: [...selectedUserIds] });
  }, [selectedUserIds, bulkSuspendMutation]);

  const applyBulkReactivate = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    bulkReactivateMutation.mutate({ userIds: [...selectedUserIds] });
  }, [selectedUserIds, bulkReactivateMutation]);

  const bulkRemoveMutation = useMutation({
    mutationFn: async ({ userIds }: { userIds: string[] }) => {
      await Promise.all(userIds.map((id) => apiClient.delete(`${API.user(id)}/remove`)));
    },
    onSuccess: (_result, variables) => {
      toast.success({ message: `Removed ${variables.userIds.length} users from workspace.` });
      setSelectedUserIds(new Set());
      setBulkRemoveConfirmOpen(false);
    },
    onError: (e: unknown) => {
      toast.error({ message: e instanceof ApiError ? e.message : "Failed to remove selected users." });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });

  const openBulkRemoveConfirm = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    setBulkRemoveConfirmOpen(true);
  }, [selectedUserIds.size]);

  const confirmBulkRemove = useCallback(() => {
    if (selectedUserIds.size === 0) return;
    bulkRemoveMutation.mutate({ userIds: [...selectedUserIds] });
  }, [selectedUserIds, bulkRemoveMutation]);

  const goToNextPage = useCallback(async () => {
    if (directoryPage < totalPages) {
      setDirectoryPage((p) => p + 1);
      return;
    }
    if (!hasUnloadedPages) return;
    const result = await fetchNextPage();
    if ((result.data?.pages?.length ?? 0) > (data?.pages?.length ?? 0)) {
      setDirectoryPage((p) => p + 1);
    }
  }, [directoryPage, totalPages, hasUnloadedPages, fetchNextPage, data?.pages?.length]);

  const goToPrevPage = useCallback(() => {
    setDirectoryPage((p) => Math.max(1, p - 1));
  }, []);

  const openUserProfile = useCallback((userId: string) => {
    router.push(`/users/${userId}`);
  }, [router]);

  const openInviteUserModal = useCallback(() => {
    setInviteUserModalOpen(true);
  }, []);

  const handleInviteUserModalClose = useCallback(() => {
    setInviteUserModalOpen(false);
  }, []);

  const refreshUsersListAfterInvite = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: userListQueryKey });
  }, [queryClient, userListQueryKey]);

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

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "770f2e"
      },
      body: JSON.stringify({
        sessionId: "770f2e",
        runId: "initial",
        hypothesisId: "H3",
        location: "app/(app)/users/users-page-client.tsx:362",
        message: "users_page_gate_and_query_state",
        data: {
          list_query_enabled: listQueryEnabled,
          live_api: liveApi,
          is_hydrated: isHydrated,
          is_authenticated: isAuthenticated,
          role: sessionUser?.role ?? null,
          leader,
          users_loading_initial: usersLoadingInitial,
          is_fetching: isFetching,
          is_error: isError,
          roster_count: rosterRows.length,
          body_state_type: bodyState.type
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }, [
    listQueryEnabled,
    liveApi,
    isHydrated,
    isAuthenticated,
    sessionUser?.role,
    leader,
    usersLoadingInitial,
    isFetching,
    isError,
    rosterRows.length,
    bodyState.type
  ]);

  const clearDirectoryFilters = useCallback(() => {
    setDirectoryUiState((s) => ({
      ...s,
      searchQuery: "",
      roleFilter: "all"
    }));
    setDebouncedSearchQuery("");
  }, []);

  const exportUsersCsv = useCallback(() => {
    const headers = ["Name", "Email", "Role", "Status"];
    const escapeCsv = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
    const lines = [headers.join(",")];
    for (const row of sortedUsers) {
      lines.push(
        [
          escapeCsv(row.name),
          escapeCsv(row.email),
          escapeCsv(row.role),
          escapeCsv(row.status),
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
    toast.success({ message: `Exported ${sortedUsers.length} users.` });
  }, [sortedUsers, toast]);

  return (
    <UsersDirectoryPageShell>
      {bodyState.type === "directory" ? (
        <>
          <UsersDirectoryBulkToolbar
            selectedCount={selectedUserIds.size}
            selectedRole={bulkRoleSelection}
            onSelectedRoleChange={setBulkRoleSelection}
            onApplyRole={applyBulkRoleChange}
            onSuspendUsers={applyBulkSuspend}
            onReactivateUsers={applyBulkReactivate}
            onRemoveUsers={openBulkRemoveConfirm}
            isApplying={bulkRoleMutation.isPending}
            isSuspending={bulkSuspendMutation.isPending}
            isReactivating={bulkReactivateMutation.isPending}
            isRemoving={bulkRemoveMutation.isPending}
            onClearSelection={() => setSelectedUserIds(new Set())}
          />
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
            rows={pagedUsers}
            currentPage={directoryPage}
            totalPages={totalPages}
            totalUsers={sortedUsers.length}
            hasUnloadedPages={hasUnloadedPages}
            isLoadingMore={isFetchingNextPage}
            isRefreshing={isFetching && !usersLoadingInitial}
            onPrevPage={goToPrevPage}
            onNextPage={() => void goToNextPage()}
            onOpenProfile={openUserProfile}
            sessionUser={sessionUser}
            roleMutation={roleMutation}
            activeRoleMutationUserId={activeRoleMutationUserId}
            selectedUserIds={selectedUserIds}
            onSelectedUserIdsChange={setSelectedUserIds}
          />
          <Modal
            open={bulkRemoveConfirmOpen}
            onClose={() => setBulkRemoveConfirmOpen(false)}
            title="Remove selected users?"
            footer={
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setBulkRemoveConfirmOpen(false)}
                  disabled={bulkRemoveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={confirmBulkRemove}
                  loading={bulkRemoveMutation.isPending}
                >
                  Remove users
                </Button>
              </>
            }
          >
            <p>
              {`You are about to remove ${selectedUserIds.size} selected users from this workspace. This action cannot be undone.`}
            </p>
          </Modal>
          {inviteUserModalOpen ? (
            <InviteUserModal
              open={inviteUserModalOpen}
              onClose={handleInviteUserModalClose}
              onInvited={refreshUsersListAfterInvite}
            />
          ) : null}
        </>
      ) : (
        <UsersDirectoryLockedPanel state={bodyState} onRetryList={() => void refetch()} />
      )}
    </UsersDirectoryPageShell>
  );
}
