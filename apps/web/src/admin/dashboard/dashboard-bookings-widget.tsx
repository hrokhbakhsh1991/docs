"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  buildDashboardBookingsKpiCards,
  dashboardBookingsHref,
  parseDashboardBookingsSummary,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

export function DashboardBookingsWidget() {
  const locale = useLocale() as AppLocale;
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
          throw new Error(`DASHBOARD_BOOKINGS_SUMMARY_HTTP_${response.status}`);
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
          setError(fetchError instanceof Error ? fetchError.message : "DASHBOARD_BOOKINGS_FAILED");
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

  const kpiCards = useMemo(() => buildDashboardBookingsKpiCards(summary), [summary]);

  return (
    <Card data-denali-surface="card" data-testid={DASHBOARD_WIDGETS_TEST_IDS.bookings} className="flex flex-col shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("bookings.title")}</CardTitle>
        <CardDescription>{t("bookings.description")}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <DenaliSkeleton className="h-14 w-full" />
            <DenaliSkeleton className="h-14 w-full" />
          </div>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-destructive" role="alert">
            {resolveDashboardErrorMessage(tErrors, error)}
          </p>
        ) : null}
        {!loading && !error ? (
          <div
            className="grid gap-3 sm:grid-cols-2"
            data-testid={DASHBOARD_WIDGETS_TEST_IDS.bookingsKpi}
          >
            {kpiCards.map((card) => (
              <div key={card.id} className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t(`kpi.${card.id}`)}</p>
                <p className="text-2xl font-bold">{formatLocalizedNumber(card.value, locale)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <Link href={dashboardBookingsHref()} className="text-sm text-primary hover:underline">
          {t("bookings.openCommandCenter")}
        </Link>
      </CardContent>
    </Card>
  );
}
