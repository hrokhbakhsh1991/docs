"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card
      data-denali-surface="card"
      data-testid={FINANCE_DASHBOARD_WIDGET_TEST_IDS.widget}
      className="flex flex-col shadow-sm sm:col-span-2 xl:col-span-2"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description", { brandName })}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <DenaliSkeleton className="h-14 w-full" />
            <DenaliSkeleton className="h-14 w-full" />
            <DenaliSkeleton className="h-14 w-full" />
          </div>
        ) : null}
        {!loading && error ? (
          <p className="text-sm text-destructive" role="alert">
            {localizeFinanceMessage(tValidation, tErrors, error)}
          </p>
        ) : null}
        {!loading && !error ? (
          <div
            className="grid gap-3 sm:grid-cols-3"
            data-testid={FINANCE_DASHBOARD_WIDGET_TEST_IDS.kpiStrip}
          >
            {kpiCards.map((card) => (
              <div key={card.id} data-denali-finance-kpi className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t(`kpi.${card.id}`)}</p>
                <p className="text-2xl font-bold">{formatLocalizedNumber(card.value, locale)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <Link href={financeDashboardWidgetHref()} className="text-sm text-primary hover:underline">
          {t("openCommandCenter")}
        </Link>
      </CardContent>
    </Card>
  );
}
