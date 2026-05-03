"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button, PageActions } from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

import { ToursListView } from "./tours-list-view";

export function ToursPageClient() {
  const router = useRouter();
  const { user } = useAuth();
  const leader = isLeaderRole(user?.role);

  const actions = useMemo(() => {
    if (!leader) return null;
    return (
      <PageActions>
        <Button type="button" variant="secondary" onClick={() => router.push("/tours/new")}>
          Create Tour
        </Button>
      </PageActions>
    );
  }, [leader, router]);

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
