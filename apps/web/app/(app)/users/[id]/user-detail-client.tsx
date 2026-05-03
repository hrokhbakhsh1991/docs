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
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { userKeys } from "@/lib/query-keys";
import { getUserById, usersUseLiveApi } from "@/lib/services/users.service";

import styles from "./user-detail.module.css";

type UserDetailClientProps = {
  userId: string;
};

function statusVariant(status: "Active" | "Invited") {
  switch (status) {
    case "Active":
      return "success" as const;
    case "Invited":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function UserDetailClient({ userId }: UserDetailClientProps) {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();
  const liveApi = usersUseLiveApi();
  const queryEnabled = Boolean(userId) && liveApi && isHydrated && isAuthenticated;
  const {
    data: user,
    isPending,
    isError,
    error
  } = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserById(userId),
    enabled: queryEnabled
  });

  const breadcrumbItems = useMemo(
    () => [
      { label: "Home", href: "/dashboard" },
      { label: "Users", href: "/users" },
      { label: user?.name ?? userId },
    ],
    [user?.name, userId],
  );

  const backActions = useMemo(
    () => (
      <PageActions>
        <Button type="button" variant="secondary" onClick={() => router.push("/users")}>
          Back to users
        </Button>
      </PageActions>
    ),
    [router],
  );

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="User details"
        title="User details"
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <LoadingState message="Loading session…" />
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="User details"
        title="User details"
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <EmptyState
          title="Sign in required"
          description="Your session is missing or expired. Sign in to load user details."
          action={
            <Button type="button" variant="primary" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          }
        />
      </RegisteredWorkspacePage>
    );
  }

  if (isPending) {
    return (
      <RegisteredWorkspacePage
        documentTitle="User details"
        title="User details"
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <LoadingState message="Loading user…" />
      </RegisteredWorkspacePage>
    );
  }

  if (isError) {
    return (
      <RegisteredWorkspacePage
        documentTitle="User details"
        title="User details"
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <ErrorState
          title="Could not load user"
          message={error instanceof ApiError ? error.message : "Could not load user."}
        />
      </RegisteredWorkspacePage>
    );
  }

  if (!user) {
    return (
      <RegisteredWorkspacePage
        documentTitle="User not found"
        title="User not found"
        description={undefined}
        breadcrumbItems={breadcrumbItems}
        actions={backActions}
      >
        <ErrorState title="User not found" message="No user matches this id in the current tenant." />
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
            </dl>
          </CardBody>
        </Card>
      </div>
    </RegisteredWorkspacePage>
  );
}
