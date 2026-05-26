"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button, PageActions } from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

import { CREATE_TOUR_ACTION_LABEL } from "./tours-copy";
import { ToursListView } from "./tours-list-view";

export function ToursPageClient() {
  const router = useRouter();
  const { user, isHydrated, isAuthenticated } = useAuth();

  const actions = useMemo(() => {
    if (!isHydrated || !isAuthenticated || !isLeaderRole(user?.role)) return null;
    return (
      <PageActions>
        <Button type="button" variant="secondary" onClick={() => router.push("/tours/new")}>
          {CREATE_TOUR_ACTION_LABEL}
        </Button>
      </PageActions>
    );
  }, [isAuthenticated, isHydrated, router, user?.role]);

  return (
    <RegisteredWorkspacePage
      documentTitle="Tours"
      title="Tours"
      description="Tenant-scoped tours from the workspace API."
      breadcrumbItems={[
        { label: "Home", href: "/dashboard" },
        { label: "Tours" },
      ]}
      actions={actions}
    >
      <ToursListView />
    </RegisteredWorkspacePage>
  );
}
