"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { DashboardKpiCell } from "@/admin/patterns/dashboard-kpi-cell";
import {
  DashboardKpiGrid,
  DashboardWidgetCard,
  DashboardWidgetError,
  DashboardWidgetFooterLink,
} from "@/admin/patterns/dashboard-widget-card";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  buildDashboardOverviewKpiCards,
  dashboardBookingsHref,
  parseDashboardBookingsSummary,
  parseDashboardToursList,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";
import type { BookingsSummaryResponse } from "@/features/bookings/bookings-command-center-types";

type DashboardOverviewWidgetProps = {
  readonly initialToursTotal?: number | null;
  readonly initialBookingsSummary?: BookingsSummaryResponse | null;
};

export function DashboardOverviewWidget({
  initialToursTotal = null,
  initialBookingsSummary = null,
}: DashboardOverviewWidgetProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dashboard");
  const tErrors = useTranslations("dashboard.errors");
  const brandName = useTenantBrandTitle();
  const hasInitialData = initialToursTotal !== null && initialBookingsSummary !== null;
  const [loading, setLoading] = useState(!hasInitialData);
  const [error, setError] = useState<string | null>(null);
  const [toursTotal, setToursTotal] = useState(initialToursTotal ?? 0);
  const [summary, setSummary] = useState(
    initialBookingsSummary ?? parseDashboardBookingsSummary(null)
  );

  useEffect(() => {
    if (hasInitialData) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetch("/api/tours?view=operator&limit=1", { cache: "no-store" }),
      fetch("/api/bookings/summary", { cache: "no-store" }),
    ])
      .then(async ([toursRes, summaryRes]) => {
        if (!toursRes.ok) {
          throw new Error(`DASHBOARD_TOURS_HTTP_${toursRes.status}`);
        }
        if (!summaryRes.ok) {
          throw new Error(`DASHBOARD_BOOKINGS_SUMMARY_HTTP_${summaryRes.status}`);
        }
        const toursPayload = parseDashboardToursList(await toursRes.json());
        const summaryPayload = parseDashboardBookingsSummary(await summaryRes.json());
        if (!cancelled) {
          setToursTotal(toursPayload.total);
          setSummary(summaryPayload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "DASHBOARD_OVERVIEW_FAILED");
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
  }, [hasInitialData]);

  const kpiCards = useMemo(
    () => buildDashboardOverviewKpiCards(toursTotal, summary),
    [summary, toursTotal]
  );

  return (
    <DashboardWidgetCard
      testId={DASHBOARD_WIDGETS_TEST_IDS.overview}
      title={t("overview.title")}
      description={t("overview.description", { brandName })}
      footer={
        <DashboardWidgetFooterLink href={dashboardBookingsHref()}>
          {t("overview.openBookings")}
        </DashboardWidgetFooterLink>
      }
    >
      {loading ? (
        <DashboardKpiGrid>
          <OperatorSkeleton size="kpi" />
          <OperatorSkeleton size="kpi" />
          <OperatorSkeleton size="kpi" />
          <OperatorSkeleton size="kpi" />
        </DashboardKpiGrid>
      ) : null}
      {!loading && error ? (
        <DashboardWidgetError>{resolveDashboardErrorMessage(tErrors, error)}</DashboardWidgetError>
      ) : null}
      {!loading && !error ? (
        <DashboardKpiGrid testId={DASHBOARD_WIDGETS_TEST_IDS.overviewKpi}>
          {kpiCards.map((card) => (
            <DashboardKpiCell
              key={card.id}
              label={t(`kpi.${card.id}`)}
              value={formatLocalizedNumber(card.value, locale)}
            />
          ))}
        </DashboardKpiGrid>
      ) : null}
    </DashboardWidgetCard>
  );
}
