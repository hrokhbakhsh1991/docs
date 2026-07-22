"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import {
  groupInstallmentsByBoardColumn,
  parseSchedulesListResponse,
  type PaymentScheduleItem,
} from "@/finance/finance-installments-logic";
import { parseFinancePaymentsListResponse } from "@/finance/finance-payments-logic";
import { parseFinancePendingReceiptsResponse } from "@/finance/finance-receipts-logic";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import {
  FINANCE_OVERVIEW_TEST_IDS,
  buildFinanceAttentionSamples,
  buildFinanceKpiCards,
  formatFinanceTimestamp,
  formatLedgerEventLabel,
  parseFinanceByTourReport,
  parseFinanceLedgerListResponse,
  parseFinanceSummary,
  type FinanceAttentionKind,
  type FinanceAttentionSample,
  type FinanceByTourReport,
  type FinanceLedgerEvent,
  type FinanceSummary,
} from "@/finance/finance-reports-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import type { FinanceOverviewServerPrefetch } from "./fetch-finance-overview.server";

type FinanceOverviewPanelProps = {
  readonly initialOverview?: FinanceOverviewServerPrefetch | null;
};

function attentionKindLabel(
  kind: FinanceAttentionKind,
  labels: Record<FinanceAttentionKind, string>
): string {
  return labels[kind];
}

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
  const [summary, setSummary] = useState<FinanceSummary>(
    initialOverview?.summary ?? parseFinanceSummary(null)
  );
  const [ledgerItems, setLedgerItems] = useState<readonly FinanceLedgerEvent[]>(
    initialOverview?.ledgerItems ?? parseFinanceLedgerListResponse(null).items
  );
  const [overdueInstallments, setOverdueInstallments] = useState(
    initialOverview?.overdueInstallments ?? 0
  );
  const [attentionSamples, setAttentionSamples] = useState<readonly FinanceAttentionSample[]>([]);
  const [paidByTour, setPaidByTour] = useState<FinanceByTourReport["items"]>([]);
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
      fetch("/api/finance/reports/by-tour", { cache: "no-store" }),
      fetch("/api/finance/schedules", { cache: "no-store" }),
      fetch("/api/finance/payments?limit=20", { cache: "no-store" }),
      fetch("/api/finance/receipts/pending?limit=20", { cache: "no-store" }),
    ])
      .then(async ([summaryRes, ledgerRes, byTourRes, schedulesRes, paymentsRes, receiptsRes]) => {
        if (!summaryRes.ok) {
          throw new Error(`SUMMARY_HTTP_${summaryRes.status}`);
        }
        if (!ledgerRes.ok) {
          throw new Error(`LEDGER_HTTP_${ledgerRes.status}`);
        }
        const summaryPayload = parseFinanceSummary(await summaryRes.json());
        const ledgerPayload = parseFinanceLedgerListResponse(await ledgerRes.json());
        const byTourPayload = byTourRes.ok
          ? parseFinanceByTourReport(await byTourRes.json()).items.slice(0, 5)
          : [];
        let overdueRows: PaymentScheduleItem[] = [];
        if (schedulesRes.ok) {
          const schedules = parseSchedulesListResponse(await schedulesRes.json());
          overdueRows = [...groupInstallmentsByBoardColumn(schedules.items).overdue];
        }
        const payments = paymentsRes.ok
          ? parseFinancePaymentsListResponse(await paymentsRes.json()).items
          : [];
        const receipts = receiptsRes.ok
          ? parseFinancePendingReceiptsResponse(await receiptsRes.json()).items
          : [];
        const samples = buildFinanceAttentionSamples({
          overdueInstallments: overdueRows,
          pendingReceipts: receipts.map((row) => ({
            id: row.id,
            registrationId: row.payment?.registrationId ?? row.registrationContext?.registrationId ?? "",
            registrationContext: row.registrationContext,
          })),
          pendingManualPayments: payments,
        });
        if (!cancelled) {
          setSummary(summaryPayload);
          setLedgerItems(ledgerPayload.items);
          setOverdueInstallments(overdueRows.length);
          setAttentionSamples(samples);
          setPaidByTour(byTourPayload);
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

  const attentionLabels = useMemo(
    () =>
      ({
        "overdue-installment": t("attentionKindOverdue"),
        "pending-receipt": t("attentionKindReceipt"),
        "pending-manual": t("attentionKindManual"),
      }) satisfies Record<FinanceAttentionKind, string>,
    [t]
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
            <OperatorSkeleton key={index} size="user-card" />
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
              <Card key={card.id} data-operator-surface="card" data-operator-finance-kpi>
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
              <Link
                href="/settings/reconciliation-triage"
                data-testid={FINANCE_OVERVIEW_TEST_IDS.triageLink}
              >
                {t("openReconciliation")}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("triageStaysInSettings")}</p>

          <Card data-operator-surface="card" className="shadow-sm" data-testid={FINANCE_OVERVIEW_TEST_IDS.paidByTour}>
            <CardHeader>
              <CardTitle className="text-base">{t("paidByTourTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {paidByTour.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("paidByTourEmpty")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {paidByTour.map((row) => (
                    <li
                      key={row.tourId}
                      className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{row.tourTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("paidByTourRow", {
                            count: row.paidCount,
                            pending: row.pendingCount,
                          })}
                        </p>
                      </div>
                      <Link
                        href={`/finance?tab=payments&tourId=${encodeURIComponent(row.tourId)}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {formatMinorAmount(row.paidMinor, "IRR", locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card data-operator-surface="card" className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{t("attentionTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {attentionSamples.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("attentionEmpty")}</p>
              ) : (
                <ul
                  className="divide-y rounded-md border"
                  data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionList}
                >
                  {attentionSamples.map((sample) => (
                    <li
                      key={sample.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{attentionKindLabel(sample.kind, attentionLabels)}</Badge>
                          {sample.secondaryLabel ? (
                            <span className="text-sm font-medium">{sample.secondaryLabel}</span>
                          ) : null}
                        </div>
                        <FinanceRegistrationIdentity
                          registrationId={sample.registrationId}
                          context={sample.registrationContext}
                        />
                      </div>
                      <Link href={sample.href} className="text-sm text-primary hover:underline">
                        {t("viewDetails")}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card data-operator-surface="card" className="shadow-sm">
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
                          <FinanceRegistrationIdentity
                            registrationId={event.registrationId}
                            context={event.registrationContext}
                          />
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
