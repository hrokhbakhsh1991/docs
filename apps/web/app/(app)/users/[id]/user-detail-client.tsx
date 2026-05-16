"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageActions,
} from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import { getUserById, usersUseLiveApi } from "@/lib/services/users.service";

import styles from "./user-detail.module.css";
import { UserAdminActionsCard } from "./user-admin-actions-card";
import { UserCapabilitiesCard } from "./user-capabilities-card";
import { UserRoleHistoryCard } from "./user-role-history-card";
import { USERS_ROUTE_COPY } from "../users-copy";

const detailCopy = USERS_ROUTE_COPY.detail;
const listCopy = USERS_ROUTE_COPY.list;

type UserDetailClientProps = {
  userId: string;
};

function statusVariant(status: "Active" | "Invited" | "Suspended" | string) {
  switch (status) {
    case "Active":
      return "success" as const;
    case "Invited":
      return "warning" as const;
    case "Suspended":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function detailErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return detailCopy.loadError403;
    return error.message.trim() || detailCopy.loadErrorFallback;
  }
  return detailCopy.loadErrorFallback;
}

function detailErrorTitle(error: unknown): string {
  return error instanceof ApiError && error.status === 403
    ? detailCopy.loadErrorAccessTitle
    : detailCopy.loadErrorTitle;
}

export function UserDetailClient({ userId }: UserDetailClientProps) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user: sessionUser } = useAuth();
  const leader = isLeaderRole(sessionUser?.role);
  const liveApi = usersUseLiveApi();
  const tenantScope = sessionUser?.tenantId ?? "anonymous";
  const queryEnabled = Boolean(userId) && liveApi && isHydrated && isAuthenticated && leader;
  const {
    data: user,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: userKeys.detail(tenantScope, userId),
    queryFn: () => getUserById(userId),
    enabled: queryEnabled,
  });

  const breadcrumbItems = useMemo(
    () => [
      { label: "Home", href: "/dashboard" },
      { label: USERS_ROUTE_COPY.list.breadcrumbUsers, href: "/users" },
      { label: user?.name ?? userId },
    ],
    [user?.name, userId],
  );

  const backActions = useMemo(
    () => (
      <PageActions>
        <Button type="button" variant="secondary" onClick={() => router.push("/users")}>
          {detailCopy.backToUsers}
        </Button>
      </PageActions>
    ),
    [router],
  );

  /*
    State order (mutually exclusive):
    1) Session hydration when API URL exists — avoid wrong downstream states
    2) Signed out
    3) No backend URL — directory unavailable (must run before fetch / “not found”)
    4) Loading profile (including refetch)
    5) Fetch failed
    6) Fetch succeeded but member not in roster for this workspace
    7) Success — detail card
  */
  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <LoadingState message={detailCopy.loadingSession} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <EmptyState
              title={detailCopy.signInTitle}
              description={detailCopy.signInDescription}
              action={
                <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              }
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isAuthenticated && !leader) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <ErrorState title={detailCopy.loadErrorAccessTitle} message={detailCopy.loadError403} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (!liveApi) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <EmptyState title={listCopy.apiNotConfiguredTitle} description={listCopy.apiNotConfiguredDescription} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isPending) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <LoadingState message={detailCopy.loadingProfile} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.loadingDocumentTitle}
        title={detailCopy.loadingTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <ErrorState
              title={detailErrorTitle(error)}
              message={detailErrorMessage(error)}
              onRetry={() => void refetch()}
            />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (user == null) {
    return (
      <RegisteredWorkspacePage
        documentTitle={detailCopy.notFoundTitle}
        title={detailCopy.notFoundTitle}
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <Card>
          <CardBody>
            <ErrorState title={detailCopy.notFoundTitle} message={detailCopy.notFoundMessage} />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle={user.name}
      title={user.name}
      description={user.email}
      breadcrumbItems={breadcrumbItems}
      actions={backActions}
    >
      <div className={styles.stack}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.fields}>
              <div className={styles.field}>
                <dt className={styles.term}>Name</dt>
                <dd className={styles.def}>{user.name}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Email</dt>
                <dd className={styles.def}>{user.email}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Role</dt>
                <dd className={styles.def}>{user.role}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Status</dt>
                <dd className={styles.def}>
                  <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                </dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Phone</dt>
                <dd className={styles.def}>{user.phone?.trim() ? user.phone : "—"}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Phone verification</dt>
                <dd className={styles.def}>{user.isPhoneVerified ? "Verified" : "Unverified"}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Joined At</dt>
                <dd className={styles.def}>{formatDateTime(user.joinedAt)}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Invited At</dt>
                <dd className={styles.def}>{formatDateTime(user.invitedAt)}</dd>
              </div>
              <div className={styles.field}>
                <dt className={styles.term}>Last Login</dt>
                <dd className={styles.def}>{formatDateTime(user.lastLoginAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <UserAdminActionsCard
          userId={userId}
          tenantScope={tenantScope}
          currentRole={user.role}
          currentStatus={user.status}
          sessionUserId={sessionUser?.userId}
          onChanged={() => void refetch()}
        />
        <UserCapabilitiesCard
          tenantId={tenantScope}
          userId={userId}
          user={user}
          onChanged={() => void refetch()}
        />
        <UserRoleHistoryCard userId={userId} tenantScope={tenantScope} enabled={queryEnabled} />
      </div>
    </RegisteredWorkspacePage>
  );
}
