"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  dashboardPendingBookingsHref,
  parseDashboardBookingsSummary,
  selectRegistrationQueueChips,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";

export function DashboardRegistrationsWidget() {
  const t = useTranslations("dashboard");
  const tErrors = useTranslations("dashboard.errors");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(parseDashboardBookingsSummary(null));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch("/api/bookings/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`DASHBOARD_REGISTRATIONS_HTTP_${response.status}`);
        }
        return parseDashboardBookingsSummary(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setSummary(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error ? fetchError.message : "DASHBOARD_REGISTRATIONS_FAILED"
          );
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
  }, []);

  const queueChips = useMemo(() => selectRegistrationQueueChips(summary), [summary]);

  return (
    <Card data-denali-surface="card" data-testid={DASHBOARD_WIDGETS_TEST_IDS.registrations} className="flex flex-col shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("registrations.title")}</CardTitle>
        <CardDescription>
          {loading ? t("registrations.loading") : t("registrations.pendingCount", { count: summary.pending })}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        {loading ? (
          <div className="space-y-2">
            <DenaliSkeleton className="h-8 w-full" />
            <DenaliSkeleton className="h-8 w-full" />
          </div>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-destructive" role="alert">
            {resolveDashboardErrorMessage(tErrors, error)}
          </p>
        ) : null}
        {!loading && !error ? (
          <ul className="space-y-2">
            {queueChips.length === 0 ? (
              <li>
                <DenaliEmptyState description={t("registrations.empty")} icon="trees" />
              </li>
            ) : (
              queueChips.map((chip) => (
                <li
                  key={chip.tourId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="truncate">{chip.tourTitle}</span>
                  <span className="shrink-0 font-medium">
                    {t("registrations.pendingOnTour", { count: chip.pendingCount })}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
        <Link href={dashboardPendingBookingsHref()} className="text-sm text-primary hover:underline">
          {t("registrations.reviewPending")}
        </Link>
      </CardContent>
    </Card>
  );
}
