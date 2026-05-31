"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, PageActions } from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";

import { SeedDenaliUiTestToursButton } from "@/features/tours/dev/SeedDenaliUiTestToursButton";

import { ToursListView } from "./tours-list-view";

export function ToursPageClient() {
  const router = useRouter();
  const { user, isHydrated, isAuthenticated } = useAuth();
  const t = useTranslations("tours.list");

  const actions = useMemo(() => {
    if (!isHydrated || !isAuthenticated || !isLeaderRole(user?.role)) return null;
    return (
      <PageActions>
        <SeedDenaliUiTestToursButton />
        <Button type="button" variant="secondary" onClick={() => router.push("/tours/new")}>
          {t("createTour")}
        </Button>
      </PageActions>
    );
  }, [isAuthenticated, isHydrated, router, t, user?.role]);

  return (
    <RegisteredWorkspacePage
      documentTitle={t("pageTitle")}
      title={t("pageTitle")}
      description={t("pageDescription")}
      breadcrumbItems={[
        { label: t("breadcrumbHome"), href: "/dashboard" },
        { label: t("breadcrumbTours") },
      ]}
      actions={actions}
    >
      <ToursListView />
    </RegisteredWorkspacePage>
  );
}
