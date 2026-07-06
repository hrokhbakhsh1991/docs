"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import {
  DashboardWidgetCard,
  DashboardWidgetFooterLink,
} from "@/admin/patterns/dashboard-widget-card";
import {
  DASHBOARD_WIDGETS_TEST_IDS,
  dashboardPendingBookingsHref,
  parseDashboardBookingsSummary,
  selectRegistrationQueueChips,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { resolveDashboardErrorMessage } from "@/i18n/resolve-dashboard-error-message";

import type { BookingsSummaryResponse } from "@/features/bookings/bookings-command-center-types";

type DashboardRegistrationsWidgetProps = {
  readonly initialBookingsSummary?: BookingsSummaryResponse | null;
};

export function DashboardRegistrationsWidget({
  initialBookingsSummary = null,
}: DashboardRegistrationsWidgetProps) {
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
  }, [initialBookingsSummary]);

  const queueChips = useMemo(() => selectRegistrationQueueChips(summary), [summary]);

  return (
    <DashboardWidgetCard
      testId={DASHBOARD_WIDGETS_TEST_IDS.registrations}
      title={t("registrations.title")}
      description={
        loading ? t("registrations.loading") : t("registrations.pendingCount", { count: summary.pending })
      }
      footer={
        <DashboardWidgetFooterLink href={dashboardPendingBookingsHref()}>
          {t("registrations.reviewPending")}
        </DashboardWidgetFooterLink>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <DenaliSkeleton size="row" />
          <DenaliSkeleton size="row" />
        </div>
      ) : null}
      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {resolveDashboardErrorMessage(tErrors, error)}
        </p>
      ) : null}
      {!loading && !error ? (
        <ul className="flex flex-1 flex-col gap-2">
          {queueChips.length === 0 ? (
            <li className="flex flex-1 items-center">
              <DenaliEmptyState description={t("registrations.empty")} icon="trees" />
            </li>
          ) : (
            queueChips.map((chip) => (
              <li
                key={chip.tourId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-start">{chip.tourTitle}</span>
                <span className="shrink-0 text-end text-xs font-medium tabular-nums sm:text-sm">
                  {t("registrations.pendingOnTour", { count: chip.pendingCount })}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </DashboardWidgetCard>
  );
}
