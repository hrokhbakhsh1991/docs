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
  parseFinanceByTourReport,
  parseFinanceLedgerListResponse,
  parseFinanceSummary,
  resolveFinanceAttentionOverflow,
  resolveFinanceLedgerEventLabel,
  type FinanceAttentionKind,
  type FinanceAttentionSample,
  type FinanceByTourReport,
  type FinanceLedgerEvent,
  type FinanceSummary,
} from "@/finance/finance-reports-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";
import { FinanceExceptionsFollowUpSection } from "@/finance/finance-exceptions-panel";
import {
  parseOutstandingBalancesResponse,
  parseTourCollectionsResponse,
  outstandingPaymentsHref,
  outstandingRegistrationContext,
  type OutstandingBalanceListItem,
  type TourCollectionListItem,
} from "@/finance/finance-outstanding-logic";
import {
  parseFinanceRefundsResponse,
  refundStatusI18nKey,
  type FinanceRefundListItem,
  type RefundStatus,
} from "@/finance/finance-refunds-logic";
import type { FinanceOverviewServerPrefetch } from "./fetch-finance-overview.server";

type FinanceOverviewPanelProps = {
  readonly initialOverview?: FinanceOverviewServerPrefetch | null;
  /** Manifest panels.installments — gates overdue KPI/attention and schedules fetch. */
  readonly includeInstallments?: boolean;
};

function attentionKindLabel(
  kind: FinanceAttentionKind,
  labels: Record<FinanceAttentionKind, string>
): string {
  return labels[kind];
}

function attentionActionLabel(kind: FinanceAttentionKind, t: (key: string) => string): string {
  if (kind === "pending-receipt") {
    return t("attentionActionReceipt");
  }
  if (kind === "pending-manual") {
    return t("attentionActionPayment");
  }
  if (kind === "overdue-installment") {
    return t("attentionActionInstallment");
  }
  return t("viewDetails");
}

function kpiCardActionLabel(cardId: string, t: (key: string) => string): string {
  if (cardId === "pending-manual") {
    return t("kpiOpenPaymentsList");
  }
  if (cardId === "pending-receipts") {
    return t("kpiOpenReceiptsList");
  }
  if (cardId === "overdue-installments") {
    return t("kpiOpenInstallmentsList");
  }
  return t("viewDetails");
}

function resolveRefundStatusLabel(
  status: RefundStatus,
  tRefunds: ReturnType<typeof useTranslations>
): string {
  return tRefunds(refundStatusI18nKey(status) as "statusRequested");
}

export function FinanceOverviewPanel({
  initialOverview = null,
  includeInstallments = false,
}: FinanceOverviewPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.overview");
  const tLedger = useTranslations("finance.ledger");
  const tKpi = useTranslations("finance.kpi");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const tRefunds = useTranslations("finance.refunds");
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
    includeInstallments ? (initialOverview?.overdueInstallments ?? 0) : 0
  );
  const [attentionSamples, setAttentionSamples] = useState<readonly FinanceAttentionSample[]>([]);
  const [paidByTour, setPaidByTour] = useState<FinanceByTourReport["items"]>([]);
  const [outstandingPreview, setOutstandingPreview] = useState<
    readonly OutstandingBalanceListItem[]
  >([]);
  const [tourOwed, setTourOwed] = useState<readonly TourCollectionListItem[]>([]);
  const [refundsAwaiting, setRefundsAwaiting] = useState<readonly FinanceRefundListItem[]>([]);
  const skipInitialFetchRef = useRef(initialOverview !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOutstandingPreview([]);
    setTourOwed([]);
    setRefundsAwaiting([]);

    const criticalFetches: Promise<Response>[] = [
      fetch("/api/finance/reports/summary", { cache: "no-store" }),
      fetch("/api/finance/reports/ledger-events?limit=5", { cache: "no-store" }),
      fetch("/api/finance/reports/by-tour", { cache: "no-store" }),
      fetch("/api/finance/payments?limit=20", { cache: "no-store" }),
      fetch("/api/finance/receipts/pending?limit=20", { cache: "no-store" }),
    ];
    if (includeInstallments) {
      criticalFetches.push(fetch("/api/finance/schedules", { cache: "no-store" }));
    }

    const loadDeferredPreviews = async () => {
      try {
        const outstandingRes = await fetch("/api/finance/reports/outstanding-balances?limit=5", {
          cache: "no-store",
        });
        if (!cancelled && outstandingRes.ok) {
          setOutstandingPreview(parseOutstandingBalancesResponse(await outstandingRes.json()).items);
        }

        const tourOwedRes = await fetch("/api/finance/reports/tour-collections?limit=5", {
          cache: "no-store",
        });
        if (!cancelled && tourOwedRes.ok) {
          setTourOwed(parseTourCollectionsResponse(await tourOwedRes.json()).items);
        }

        const refundsRequestedRes = await fetch("/api/finance/refunds?status=Requested&limit=5", {
          cache: "no-store",
        });
        const refundsApprovedRes = await fetch("/api/finance/refunds?status=Approved&limit=5", {
          cache: "no-store",
        });
        const refundsReq = refundsRequestedRes.ok
          ? parseFinanceRefundsResponse(await refundsRequestedRes.json()).items
          : [];
        const refundsAppr = refundsApprovedRes.ok
          ? parseFinanceRefundsResponse(await refundsApprovedRes.json()).items
          : [];
        if (!cancelled) {
          setRefundsAwaiting([...refundsReq, ...refundsAppr].slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setOutstandingPreview([]);
          setTourOwed([]);
          setRefundsAwaiting([]);
        }
      }
    };

    void Promise.all(criticalFetches)
      .then(async (responses) => {
        const [
          summaryRes,
          ledgerRes,
          byTourRes,
          paymentsRes,
          receiptsRes,
          schedulesRes,
        ] = responses;
        if (!summaryRes.ok) {
          throw new Error(`FINANCE_SUMMARY_HTTP_${summaryRes.status}`);
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
        if (includeInstallments && schedulesRes !== undefined && schedulesRes.ok) {
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
            registrationId:
              row.payment?.registrationId ?? row.registrationContext?.registrationId ?? "",
            registrationContext: row.registrationContext,
          })),
          pendingManualPayments: payments,
          includeInstallments,
        });
        if (!cancelled) {
          setSummary(summaryPayload);
          setLedgerItems(ledgerPayload.items);
          setOverdueInstallments(includeInstallments ? overdueRows.length : 0);
          setAttentionSamples(samples);
          setPaidByTour(byTourPayload);
          void loadDeferredPreviews();
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(toFinanceClientErrorCode(fetchError, "OVERVIEW_FETCH_FAILED"));
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
  }, [fetchNonce, includeInstallments]);

  const kpiCards = useMemo(
    () => buildFinanceKpiCards(summary, overdueInstallments, { includeInstallments }),
    [summary, overdueInstallments, includeInstallments]
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

  const attentionOverflow = useMemo(
    () =>
      resolveFinanceAttentionOverflow({
        samples: attentionSamples,
        pendingManualTotal: summary.pendingManualPayments,
        pendingReceiptTotal: summary.pendingReceiptReviews,
        overdueInstallmentTotal: overdueInstallments,
        includeInstallments,
      }),
    [
      attentionSamples,
      summary.pendingManualPayments,
      summary.pendingReceiptReviews,
      overdueInstallments,
      includeInstallments,
    ]
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
          {Array.from({ length: includeInstallments ? 4 : 3 }).map((_, index) => (
            <OperatorSkeleton key={index} size="user-card" />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}

      {/* 1. Needs action */}
      <section
        className="space-y-4"
        data-testid={FINANCE_OVERVIEW_TEST_IDS.needsActionSection}
        aria-label={t("needsActionTitle")}
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{t("needsActionTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("needsActionHint")}</p>
        </div>

        <FinanceExceptionsFollowUpSection />

        {!loading && !error ? (
          <Card
            data-operator-surface="card"
            className="shadow-sm"
            data-testid={FINANCE_OVERVIEW_TEST_IDS.refundsAwaiting}
          >
            <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{t("refundsAwaitingTitle")}</CardTitle>
              <Link
                href="/finance?tab=refunds"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("openRefunds")}
              </Link>
            </CardHeader>
            <CardContent>
              {refundsAwaiting.length === 0 ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid={FINANCE_OVERVIEW_TEST_IDS.refundsAwaitingEmpty}
                >
                  {t("refundsAwaitingEmpty")}{" "}
                  <Link
                    href="/finance?tab=refunds"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {t("openRefunds")}
                  </Link>
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {refundsAwaiting.map((row) => {
                    const statusLabel = resolveRefundStatusLabel(row.status, tRefunds);
                    return (
                      <li
                        key={row.id}
                        className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <Badge variant="outline">{statusLabel}</Badge>
                          <FinanceRegistrationIdentity
                            registrationId={row.registrationId}
                            context={
                              row.identity.tourId &&
                              row.identity.tourTitle &&
                              row.identity.memberDisplayName
                                ? {
                                    registrationId: row.registrationId,
                                    tourId: row.identity.tourId,
                                    tourTitle: row.identity.tourTitle,
                                    memberDisplayName: row.identity.memberDisplayName,
                                  }
                                : null
                            }
                            density="compact"
                          />
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatMinorAmount(row.amountMinor, row.currency, locale)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error ? (
          <div className="space-y-2" data-testid={FINANCE_OVERVIEW_TEST_IDS.collectionQueues}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("collectionQueuesTitle")}
            </p>
            <Card
              data-operator-surface="card"
              className="shadow-sm"
              data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionSection}
            >
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{t("attentionTitle")}</CardTitle>
                  {attentionSamples.length > 0 ? (
                    <p className="text-xs font-normal text-muted-foreground">
                      {t("attentionPreviewHint")}
                    </p>
                  ) : null}
                </div>
                {attentionSamples.length > 0 ? (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionShown}
                  >
                    {t("attentionShown", { count: attentionOverflow.shownCount })}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {attentionSamples.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("attentionEmpty")}</p>
                ) : (
                  <>
                    <ul
                      className="divide-y rounded-md border"
                      data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionList}
                    >
                      {attentionSamples.map((sample) => (
                        <li
                          key={sample.id}
                          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {attentionKindLabel(sample.kind, attentionLabels)}
                              </Badge>
                              {sample.secondaryLabel ? (
                                <span className="text-sm font-medium">{sample.secondaryLabel}</span>
                              ) : null}
                            </div>
                            <FinanceRegistrationIdentity
                              registrationId={sample.registrationId}
                              context={sample.registrationContext}
                              density="compact"
                            />
                          </div>
                          <Link
                            href={sample.href}
                            className="shrink-0 text-sm font-medium text-primary hover:underline"
                          >
                            {attentionActionLabel(sample.kind, t)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {attentionOverflow.hasOverflow ? (
                      <div
                        className="space-y-1 text-sm"
                        data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionOverflow}
                      >
                        {attentionOverflow.morePendingReceipt > 0 ? (
                          <p>
                            <Link
                              href="/finance?tab=receipts"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                              data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionMoreReceipts}
                            >
                              {t("attentionMoreReceipts", {
                                count: attentionOverflow.morePendingReceipt,
                              })}
                            </Link>
                          </p>
                        ) : null}
                        {attentionOverflow.morePendingManual > 0 ? (
                          <p>
                            <Link
                              href="/finance?tab=payments"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                              data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionMorePayments}
                            >
                              {t("attentionMorePayments", {
                                count: attentionOverflow.morePendingManual,
                              })}
                            </Link>
                          </p>
                        ) : null}
                        {attentionOverflow.moreOverdueInstallment > 0 ? (
                          <p>
                            <Link
                              href="/finance?tab=installments"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                              data-testid={FINANCE_OVERVIEW_TEST_IDS.attentionMoreInstallments}
                            >
                              {t("attentionMoreInstallments", {
                                count: attentionOverflow.moreOverdueInstallment,
                              })}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      {!loading && !error ? (
        <>
          <section
            className="space-y-3"
            data-testid={FINANCE_OVERVIEW_TEST_IDS.moneyOwedSection}
            aria-label={t("moneyOwedTitle")}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">{t("moneyOwedTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("moneyOwedHint")}</p>
              </div>
              <Link
                href="/finance?tab=outstanding"
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("openOutstanding")}
              </Link>
            </div>

            {tourOwed.length > 0 ? (
              <Card data-operator-surface="card" className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("tourOwedTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul
                    className="divide-y rounded-md border"
                    data-testid={FINANCE_OVERVIEW_TEST_IDS.tourOwed}
                  >
                    {tourOwed.map((row) => (
                      <li
                        key={row.tourId}
                        className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="font-medium">{row.tourTitle ?? row.tourId}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatMinorAmount(row.remainingMinor, row.currency, locale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <Card data-operator-surface="card" className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("outstandingPreviewTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outstandingPreview.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("outstandingPreviewEmpty")}</p>
                ) : (
                  <ul
                    className="divide-y rounded-md border"
                    data-testid={FINANCE_OVERVIEW_TEST_IDS.outstandingPreview}
                  >
                    {outstandingPreview.map((row) => (
                      <li
                        key={row.registrationId}
                        className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <FinanceRegistrationIdentity
                          registrationId={row.registrationId}
                          context={outstandingRegistrationContext(row)}
                          density="compact"
                        />
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatMinorAmount(
                              row.invoice.remainingMinor,
                              row.invoice.currency,
                              locale
                            )}
                          </p>
                          <Link
                            href={outstandingPaymentsHref(row.registrationId)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {t("openPayments")}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("collectionActivityTitle")}
            </h3>
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
                    <p className="text-2xl font-bold">
                      {formatLocalizedNumber(card.value, locale)}
                    </p>
                    {card.href ? (
                      <Link href={card.href} className="text-xs text-primary hover:underline">
                        {kpiCardActionLabel(card.id, t)}
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-2" data-testid={FINANCE_OVERVIEW_TEST_IDS.primaryActions}>
            <h3 className="text-sm font-medium text-muted-foreground">{t("doNextTitle")}</h3>
            <div className="flex flex-wrap gap-2">
              {summary.pendingReceiptReviews > 0 ? (
                <Button asChild size="sm" variant="default">
                  <Link href="/finance?tab=receipts">{t("reviewPendingReceipts")}</Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link href="/finance?tab=payments">{t("openPayments")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/finance?tab=outstanding">{t("openOutstanding")}</Link>
              </Button>
            </div>
          </div>

          <Card
            data-operator-surface="card"
            className="border-dashed border-muted bg-muted/10 shadow-none"
            data-testid={FINANCE_OVERVIEW_TEST_IDS.collectedByTour}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("collectedByTourTitle")}
              </CardTitle>
              <p className="text-xs font-normal text-muted-foreground">
                {t("collectedByTourHint")}
              </p>
            </CardHeader>
            <CardContent>
              {paidByTour.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("paidByTourEmpty")}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {paidByTour.map((row) => (
                    <li
                      key={`${row.tourId}:${row.currency}`}
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
                        {formatMinorAmount(row.paidMinor, row.currency, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <section
            className="space-y-3 rounded-md border border-dashed bg-muted/10 p-4"
            data-testid={FINANCE_OVERVIEW_TEST_IDS.auditSection}
            aria-label={t("auditSectionTitle")}
          >
            <h3 className="text-sm font-medium text-muted-foreground">{t("auditSectionTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("auditSectionHint")}</p>

            <Card data-operator-surface="card" className="border-muted shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t("recentLedger")}</CardTitle>
              </CardHeader>
              <CardContent>
                {ledgerItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noLedger")}</p>
                ) : (
                  <ul
                    className="divide-y rounded-md border"
                    data-testid={FINANCE_OVERVIEW_TEST_IDS.recentLedger}
                  >
                    {ledgerItems.map((event) => (
                      <li
                        key={event.outboxEventId}
                        className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {resolveFinanceLedgerEventLabel(event.eventType, tLedger)}
                          </p>
                          {event.registrationId ? (
                            <FinanceRegistrationIdentity
                              registrationId={event.registrationId}
                              context={event.registrationContext}
                              density="compact"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">
                            {tCommon("lines", { count: event.lineCount })}
                          </Badge>
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

            <div className="space-y-1">
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-auto px-0 text-muted-foreground"
              >
                <Link
                  href="/settings/reconciliation-triage"
                  data-testid={FINANCE_OVERVIEW_TEST_IDS.triageLink}
                >
                  {t("openReconciliation")}
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">{t("triageStaysInSettings")}</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
