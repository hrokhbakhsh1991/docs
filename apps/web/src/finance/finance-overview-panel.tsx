"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { groupInstallmentsByBoardColumn, parseSchedulesListResponse } from "@/finance/finance-installments-logic";
import {
  FINANCE_OVERVIEW_TEST_IDS,
  buildFinanceKpiCards,
  formatFinanceTimestamp,
  formatLedgerEventLabel,
  parseFinanceLedgerListResponse,
  parseFinanceSummary,
} from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import type { FinanceOverviewServerPrefetch } from "./fetch-finance-overview.server";

type FinanceOverviewPanelProps = {
  readonly initialOverview?: FinanceOverviewServerPrefetch | null;
};

export function FinanceOverviewPanel({ initialOverview = null }: FinanceOverviewPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.overview");
  const tKpi = useTranslations("finance.kpi");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const [loading, setLoading] = useState(initialOverview === null);
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [summary, setSummary] = useState(
    initialOverview?.summary ?? parseFinanceSummary(null)
  );
  const [ledgerItems, setLedgerItems] = useState(
    initialOverview?.ledgerItems ?? parseFinanceLedgerListResponse(null).items
  );
  const [overdueInstallments, setOverdueInstallments] = useState(
    initialOverview?.overdueInstallments ?? 0
  );
  const skipInitialFetchRef = useRef(initialOverview !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetch("/api/finance/reports/summary", { cache: "no-store" }),
      fetch("/api/finance/reports/ledger-events?limit=5", { cache: "no-store" }),
      fetch("/api/finance/schedules", { cache: "no-store" }),
    ])
      .then(async ([summaryRes, ledgerRes, schedulesRes]) => {
        if (!summaryRes.ok) {
          throw new Error(`SUMMARY_HTTP_${summaryRes.status}`);
        }
        if (!ledgerRes.ok) {
          throw new Error(`LEDGER_HTTP_${ledgerRes.status}`);
        }
        const summaryPayload = parseFinanceSummary(await summaryRes.json());
        const ledgerPayload = parseFinanceLedgerListResponse(await ledgerRes.json());
        let overdue = 0;
        if (schedulesRes.ok) {
          const schedules = parseSchedulesListResponse(await schedulesRes.json());
          overdue = groupInstallmentsByBoardColumn(schedules.items).overdue.length;
        }
        if (!cancelled) {
          setSummary(summaryPayload);
          setLedgerItems(ledgerPayload.items);
          setOverdueInstallments(overdue);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "OVERVIEW_FETCH_FAILED");
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
  }, [fetchNonce]);

  const kpiCards = useMemo(
    () => buildFinanceKpiCards(summary, overdueInstallments),
    [summary, overdueInstallments]
  );

  return (
    <div className="space-y-6" data-testid={FINANCE_OVERVIEW_TEST_IDS.panel}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFetchNonce((value) => value + 1)}
          disabled={loading}
        >
          {tCommon("refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <DenaliSkeleton key={index} size="user-card" />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <div
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            data-testid={FINANCE_OVERVIEW_TEST_IDS.kpiStrip}
          >
            {kpiCards.map((card) => (
              <Card key={card.id} data-denali-surface="card" data-denali-finance-kpi>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {tKpi(card.id)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatLocalizedNumber(card.value, locale)}</p>
                  {card.href ? (
                    <Link href={card.href} className="text-xs text-primary hover:underline">
                      {t("viewDetails")}
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/finance?tab=payments">{t("createManualPayment")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/reconciliation-triage">{t("openReconciliation")}</Link>
            </Button>
          </div>

          <Card data-denali-surface="card" className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("recentLedger")}</CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noLedger")}</p>
              ) : (
                <ul className="divide-y rounded-md border" data-testid={FINANCE_OVERVIEW_TEST_IDS.recentLedger}>
                  {ledgerItems.map((event) => (
                    <li key={event.outboxEventId} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{formatLedgerEventLabel(event.eventType)}</p>
                        {event.registrationId ? (
                          <p className="font-mono text-xs text-muted-foreground">
                            {event.registrationId}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{tCommon("lines", { count: event.lineCount })}</Badge>
                        <span>{formatFinanceTimestamp(event.createdAt, locale)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <Link href="/finance?tab=ledger" className="text-sm text-primary hover:underline">
                  {t("viewFullLedger")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
