"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import {
  DashboardTourListRow,
  DashboardWidgetCard,
  DashboardWidgetError,
  DashboardWidgetFooterLink,
  DashboardWidgetList,
  DashboardWidgetListEmptyItem,
  DashboardWidgetRowStack,
} from "@/admin/patterns/dashboard-widget-card";
import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  dashboardTourWorkspaceHref,
  dashboardToursHref,
  parseDashboardToursList,
  selectRecentToursForDashboard,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";

type DashboardToursWidgetProps = {
  readonly initialTours?: OperatorTourListResponse | null;
};

export function DashboardToursWidget({ initialTours = null }: DashboardToursWidgetProps) {
  const t = useTranslations("dashboard");
  const tErrors = useTranslations("dashboard.errors");
  const brandName = useTenantBrandTitle();
  const [loading, setLoading] = useState(initialTours === null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(
    initialTours ?? parseDashboardToursList(null)
  );

  useEffect(() => {
    if (initialTours !== null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch("/api/tours?view=operator&limit=3", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`DASHBOARD_TOURS_HTTP_${response.status}`);
        }
        return parseDashboardToursList(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "DASHBOARD_TOURS_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialTours]);

  const recentTours = useMemo(() => selectRecentToursForDashboard(data.items), [data.items]);

  return (
    <DashboardWidgetCard
      testId={DASHBOARD_WIDGETS_TEST_IDS.tours}
      title={t("tours.title")}
      description={loading ? t("tours.loading") : t("tours.count", { count: data.total, brandName })}
      footer={
        <DashboardWidgetFooterLink href={dashboardToursHref()}>
          {t("tours.viewAll")}
        </DashboardWidgetFooterLink>
      }
    >
      {loading ? (
        <DashboardWidgetRowStack>
          <DenaliSkeleton size="row" />
          <DenaliSkeleton size="row" />
        </DashboardWidgetRowStack>
      ) : null}
      {!loading && error ? (
        <DashboardWidgetError>{resolveDashboardErrorMessage(tErrors, error)}</DashboardWidgetError>
      ) : null}
      {!loading && !error ? (
        <DashboardWidgetList testId={DASHBOARD_WIDGETS_TEST_IDS.toursList}>
          {recentTours.length === 0 ? (
            <DashboardWidgetListEmptyItem>
              <DenaliEmptyState
                description={t("tours.empty")}
                action={
                  <Button asChild size="sm">
                    <Link href={OPERATOR_WIZARD_PATH}>{t("quickActions.newTour")}</Link>
                  </Button>
                }
              />
            </DashboardWidgetListEmptyItem>
          ) : (
            recentTours.map((tour) => (
              <DashboardTourListRow
                key={tour.id}
                href={dashboardTourWorkspaceHref(tour.id)}
                title={tour.title}
                statusLabel={t(`tourStatus.${tour.uiStatus}`)}
              />
            ))
          )}
        </DashboardWidgetList>
      ) : null}
    </DashboardWidgetCard>
  );
}
