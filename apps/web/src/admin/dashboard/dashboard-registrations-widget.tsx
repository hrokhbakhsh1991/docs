"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import {
  DashboardRegistrationListRow,
  DashboardWidgetCard,
  DashboardWidgetError,
  DashboardWidgetFooterLink,
  DashboardWidgetList,
  DashboardWidgetListEmptyItem,
  DashboardWidgetRowStack,
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
        <DashboardWidgetRowStack>
          <DenaliSkeleton size="row" />
          <DenaliSkeleton size="row" />
        </DashboardWidgetRowStack>
      ) : null}
      {!loading && error ? (
        <DashboardWidgetError>{resolveDashboardErrorMessage(tErrors, error)}</DashboardWidgetError>
      ) : null}
      {!loading && !error ? (
        <DashboardWidgetList>
          {queueChips.length === 0 ? (
            <DashboardWidgetListEmptyItem>
              <DenaliEmptyState description={t("registrations.empty")} icon="trees" />
            </DashboardWidgetListEmptyItem>
          ) : (
            queueChips.map((chip) => (
              <DashboardRegistrationListRow
                key={chip.tourId}
                title={chip.tourTitle}
                countLabel={t("registrations.pendingOnTour", { count: chip.pendingCount })}
              />
            ))
          )}
        </DashboardWidgetList>
      ) : null}
    </DashboardWidgetCard>
  );
}
