"use client";

import { useRouter } from "next/navigation";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { Button, Card, CardBody, EmptyState, LoadingState } from "@tour/ui";

import { DashboardWidgetsGrid } from "./widgets/dashboard-widget-registry";
import styles from "./dashboard.module.css";

export function DashboardPageClient() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user } = useAuth();
  const liveApi = toursUseLiveApi();

  if (liveApi && !isHydrated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card>
          <CardBody>
            <LoadingState message="Loading session…" />
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  if (liveApi && isHydrated && !isAuthenticated) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card>
          <CardBody>
            <EmptyState
              title="Sign in required"
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

  if (isHydrated && isAuthenticated && !isLeaderRole(user?.role)) {
    return (
      <RegisteredWorkspacePage
        documentTitle="Dashboard"
        title="Dashboard"
        breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      >
        <Card>
          <CardBody>
            <p dir="rtl" className={styles.bodyText}>
              شما دسترسی رهبر ندارید.
            </p>
          </CardBody>
        </Card>
      </RegisteredWorkspacePage>
    );
  }

  return (
    <RegisteredWorkspacePage
      documentTitle="Dashboard"
      title="Leader dashboard"
      description="Pending registrations, per-tour workspace, payment updates — all wired to documented /api/v2 routes."
      breadcrumbItems={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
    >
      <DashboardWidgetsGrid />
    </RegisteredWorkspacePage>
  );
}
