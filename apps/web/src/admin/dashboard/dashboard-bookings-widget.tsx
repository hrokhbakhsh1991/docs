"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { DashboardKpiCell } from "@/admin/patterns/dashboard-kpi-cell";
import {
  DashboardKpiGrid,
  DashboardWidgetCard,
  DashboardWidgetFooterLink,
} from "@/admin/patterns/dashboard-widget-card";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  buildDashboardBookingsKpiCards,
  dashboardBookingsHref,
  parseDashboardBookingsSummary,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

import type { BookingsSummaryResponse } from "@/features/bookings/bookings-command-center-types";

type DashboardBookingsWidgetProps = {
  readonly initialBookingsSummary?: BookingsSummaryResponse | null;
};

export function DashboardBookingsWidget({
  initialBookingsSummary = null,
}: DashboardBookingsWidgetProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dashboard");
  const tErrors = useTranslations("dashboard.errors");
  const [loading, setLoading] = useState(initialBookingsSummary === null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(
    initialBookingsSummary ?? parseDashboardBookingsSummary(null)
  );

  useEffect(() => {
    if (initialBookingsSummary !== null) {
      return;
    }

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
  }, [initialBookingsSummary]);

  const kpiCards = useMemo(() => buildDashboardBookingsKpiCards(summary), [summary]);

  return (
    <DashboardWidgetCard
      testId={DASHBOARD_WIDGETS_TEST_IDS.bookings}
      title={t("bookings.title")}
      description={t("bookings.description")}
      footer={
        <DashboardWidgetFooterLink href={dashboardBookingsHref()}>
          {t("bookings.openCommandCenter")}
        </DashboardWidgetFooterLink>
      }
    >
      {loading ? (
        <DashboardKpiGrid>
          <DenaliSkeleton size="kpi" />
          <DenaliSkeleton size="kpi" />
          <DenaliSkeleton size="kpi" />
          <DenaliSkeleton size="kpi" />
        </DashboardKpiGrid>
      ) : null}
      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {resolveDashboardErrorMessage(tErrors, error)}
        </p>
      ) : null}
      {!loading && !error ? (
        <DashboardKpiGrid testId={DASHBOARD_WIDGETS_TEST_IDS.bookingsKpi}>
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
