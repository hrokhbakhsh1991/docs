"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { DashboardKpiCell } from "@/admin/patterns/dashboard-kpi-cell";
import {
  DashboardWidgetCard,
  DashboardWidgetFooterLink,
} from "@/admin/patterns/dashboard-widget-card";
import {
  FINANCE_DASHBOARD_WIDGET_TEST_IDS,
  buildDashboardFinanceKpiCards,
  financeDashboardWidgetHref,
  parseDashboardFinanceSummary,
} from "@/finance/finance-dashboard-widget-logic";
import type { FinanceSummary } from "@/finance/finance-reports-logic";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

type FinanceDashboardWidgetProps = {
  readonly initialFinanceSummary?: FinanceSummary | null;
};

export function FinanceDashboardWidget({
  initialFinanceSummary = null,
}: FinanceDashboardWidgetProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dashboard.finance");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const brandName = useTenantBrandTitle();
  const [loading, setLoading] = useState(initialFinanceSummary === null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(
    initialFinanceSummary ?? parseDashboardFinanceSummary(null)
  );

  useEffect(() => {
    if (initialFinanceSummary !== null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/reports/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("FINANCE_SUMMARY_FAILED");
        }
        return parseDashboardFinanceSummary(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setSummary(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "FINANCE_SUMMARY_FAILED");
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
  }, [initialFinanceSummary]);

  const kpiCards = useMemo(() => buildDashboardFinanceKpiCards(summary), [summary]);

  return (
    <DashboardWidgetCard
      testId={FINANCE_DASHBOARD_WIDGET_TEST_IDS.widget}
      title={t("title")}
      description={t("description", { brandName })}
      footer={
        <DashboardWidgetFooterLink href={financeDashboardWidgetHref()}>
          {t("openCommandCenter")}
        </DashboardWidgetFooterLink>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DenaliSkeleton className="h-[5.25rem] w-full" />
          <DenaliSkeleton className="h-[5.25rem] w-full" />
          <DenaliSkeleton className="h-[5.25rem] w-full" />
        </div>
      ) : null}
      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}
      {!loading && !error ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          data-testid={FINANCE_DASHBOARD_WIDGET_TEST_IDS.kpiStrip}
        >
          {kpiCards.map((card) => (
            <DashboardKpiCell
              key={card.id}
              label={t(`kpi.${card.id}`)}
              value={formatLocalizedNumber(card.value, locale)}
              variant="finance"
            />
          ))}
        </div>
      ) : null}
    </DashboardWidgetCard>
  );
}
