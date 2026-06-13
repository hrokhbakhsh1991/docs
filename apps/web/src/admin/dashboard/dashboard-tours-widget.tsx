"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card data-denali-surface="card" data-testid={DASHBOARD_WIDGETS_TEST_IDS.tours} className="flex flex-col shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("tours.title")}</CardTitle>
        <CardDescription>
          {loading ? t("tours.loading") : t("tours.count", { count: data.total, brandName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        {loading ? (
          <div className="space-y-2">
            <DenaliSkeleton className="h-10 w-full" />
            <DenaliSkeleton className="h-10 w-full" />
          </div>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-destructive" role="alert">
            {resolveDashboardErrorMessage(tErrors, error)}
          </p>
        ) : null}
        {!loading && !error ? (
          <ul
            className="space-y-2"
            data-testid={DASHBOARD_WIDGETS_TEST_IDS.toursList}
          >
            {recentTours.length === 0 ? (
              <li>
                <DenaliEmptyState
                  description={t("tours.empty")}
                  action={
                    <Button asChild size="sm">
                      <Link href={OPERATOR_WIZARD_PATH}>{t("quickActions.newTour")}</Link>
                    </Button>
                  }
                />
              </li>
            ) : (
              recentTours.map((tour) => (
                <li key={tour.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <Link
                      href={dashboardTourWorkspaceHref(tour.id)}
                      className="truncate text-sm font-medium text-primary hover:underline"
                    >
                      {tour.title}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t(`tourStatus.${tour.uiStatus}`)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
        <Link href={dashboardToursHref()} className="text-sm text-primary hover:underline">
          {t("tours.viewAll")}
        </Link>
      </CardContent>
    </Card>
  );
}
