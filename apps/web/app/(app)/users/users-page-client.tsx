"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageActions,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, LEADER_WORKSPACE_ACCESS_DENIED, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import {
  getUsers,
  updateUserRole,
  usersUseLiveApi
} from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

import {
  filterAndSortUsers,
  normalizeRole,
  paginateUsers,
  roleLabel,
  roleVariant,
  statusVariant,
  type RoleFilter,
  type UserSortColumn,
  USERS_PAGE_SIZE,
} from "./users-page-logic";
import styles from "./users-page.module.css";

function usersErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "You are not allowed to view users in this workspace.";
    return error.message.trim() || "Could not load users.";
  }
  return "Could not load users.";
}

export function UsersPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = usersUseLiveApi();
  const leader = isLeaderRole(user?.role);
  const queryEnabled = liveApi && isHydrated && isAuthenticated && leader;

  const {
    data: users = [],
    isPending: usersLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: userKeys.lists(),
    queryFn: getUsers,
    enabled: queryEnabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success({ message: "User role updated." });
    },
    onError: (e: unknown) => {
      toast.error({
        message: e instanceof ApiError ? e.message : "Could not update role."
      });
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortColumn, setSortColumn] = useState<UserSortColumn>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter]);

  const queryNorm = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const sortedUsers = useMemo(() => {
    return filterAndSortUsers(users, {
      roleFilter,
      queryNorm,
      sortColumn,
      sortDir,
    });
  }, [users, roleFilter, queryNorm, sortColumn, sortDir]);

  const totalPages = sortedUsers.length === 0 ? 0 : Math.ceil(sortedUsers.length / USERS_PAGE_SIZE);

  useEffect(() => {
    if (totalPages === 0) return;
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  const effectivePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);

  const paginatedUsers = useMemo(() => {
    if (totalPages === 0) return [];
    return paginateUsers(sortedUsers, effectivePage);
  }, [sortedUsers, totalPages, effectivePage]);

  function toggleUserSort(column: UserSortColumn) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  const actions = useMemo(
    () => (
      <PageActions>
        <Button
          type="button"
          variant="secondary"
          onClick={() => toast.info({ message: "Invite flow is not in scope yet." })}
        >
          Add User
        </Button>
      </PageActions>
    ),
    [toast],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle="Users"
      title="Users"
      description="Tenant users from GET /api/v2/users. Role updates use PATCH /api/v2/users/:id."
      breadcrumbItems={[
        { label: "Home", href: "/dashboard" },
        { label: "Users" },
      ]}
      actions={actions}
    >
      {!isHydrated && liveApi ? (
        <Card>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      ) : liveApi && !isAuthenticated ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Sign in required"
              description="Your session is missing or expired. Sign in to load users."
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : liveApi && isAuthenticated && !leader ? (
        <Card>
          <CardBody>
            <EmptyState
              title={LEADER_WORKSPACE_ACCESS_DENIED.title}
              description={LEADER_WORKSPACE_ACCESS_DENIED.description}
              action={
                <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : usersLoading ? (
        <Card>
          <CardBody>
            <LoadingState message="Loading users…" />
          </CardBody>
        </Card>
      ) : isError ? (
        <Card>
          <CardBody>
            <ErrorState
              title="Could not load users"
              message={usersErrorMessage(error)}
              onRetry={() => void refetch()}
            />
          </CardBody>
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No users yet"
              description="Invite teammates once your workspace API is live."
              action={
                <Button type="button" variant="primary" onClick={() => toast.info({ message: "Invite flow is not in scope yet." })}>
                  Add User
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className={styles.toolbar}>
              <div className={styles.toolbarGrow}>
                <FormField label="Search" description="Name or email">
                  <Input
                    type="search"
                    placeholder="Search users…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    aria-label="Search users"
                  />
                </FormField>
              </div>
              <div className={styles.toolbarFixed}>
                <FormField label="Role">
                  <Select
                    aria-label="Filter by role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  >
                    <option value="all">All</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </Select>
                </FormField>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {sortedUsers.length === 0 ? (
              <EmptyState title="No results found" description="Adjust search or filters and try again." />
            ) : (
              <Table aria-label="Workspace users">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>
                      <span className={styles.sortCellInner}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleUserSort("name")}>
                          Name
                        </Button>
                        {sortColumn === "name" ? <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                      </span>
                    </TableHeaderCell>
                    <TableHeaderCell>
                      <span className={styles.sortCellInner}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleUserSort("email")}>
                          Email
                        </Button>
                        {sortColumn === "email" ? <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                      </span>
                    </TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className={styles.actionsCell}>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge className={styles.roleBadge} variant={roleVariant(user.role)}>
                          {roleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                      </TableCell>
                      <TableCell className={styles.actionsCell}>
                        <div className={styles.inlineActions}>
                          <Select
                            aria-label={`Change role for ${user.name}`}
                            value={normalizeRole(user.role)}
                            disabled={roleMutation.isPending}
                            onChange={(e) =>
                              void roleMutation.mutateAsync({
                                userId: user.id,
                                role: e.target.value
                              })
                            }
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </Select>
                          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/users/${user.id}`)}>
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
          {totalPages > 0 ? (
            <CardFooter>
              <div className={styles.paginationBar}>
                <span className={styles.pageIndicator}>
                  Page {effectivePage} of {totalPages}
                </span>
                <span className={styles.sortCellInner}>
                  <Button type="button" variant="secondary" disabled={effectivePage <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={effectivePage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </span>
              </div>
            </CardFooter>
          ) : null}
        </Card>
      )}
    </RegisteredWorkspacePage>
  );
}
