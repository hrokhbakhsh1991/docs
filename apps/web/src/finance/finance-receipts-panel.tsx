"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  FinanceReceiptReviewContent,
  type ReceiptReviewResultBanner,
} from "@/finance/finance-receipt-review-content";
import {
  withFinanceListScopeQuery,
  withFinanceRegistrationQuery,
} from "@/finance/finance-registration-context";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  RECEIPT_QUEUE_FETCH_LIMIT,
  parseFinancePendingReceiptsResponse,
  resolveReceiptQueueHonesty,
  type FinancePendingReceipt,
  type FinancePendingReceiptsResponse,
} from "@/finance/finance-receipts-logic";

type ReceiptsLoadPhase = "loading" | "ready" | "error";

type FinanceReceiptsPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialReceipts?: FinancePendingReceiptsResponse | null;
  /**
   * Optional pending-receipt total already known to the parent.
   * PR23-B1 — never fetched here; omit when unknown (no fake total).
   */
  readonly pendingTotal?: number;
};

export function FinanceReceiptsPanel({
  session,
  initialReceipts = null,
  pendingTotal,
}: FinanceReceiptsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.receipts");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const router = useRouter();
  const canManage = isAdminOrOwnerRole(session.role);
  const searchParams = useSearchParams();
  const registrationFilter = searchParams.get("registrationId");
  const tourFilter = searchParams.get("tourId");
  const [items, setItems] = useState<readonly FinancePendingReceipt[]>(initialReceipts?.items ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialReceipts?.nextCursor ?? null
  );
  const [hasMore, setHasMore] = useState(initialReceipts?.hasMore === true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [phase, setPhase] = useState<ReceiptsLoadPhase>(() =>
    initialReceipts === null ? "loading" : "ready"
  );
  const [error, setError] = useState<string | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [lastResult, setLastResult] = useState<ReceiptReviewResultBanner | null>(null);
  const skipInitialFetchRef = useRef(initialReceipts !== null);
  const loading = phase === "loading";
  /** Presentation clock for aging — not injected from domain. */
  const [queueNow] = useState(() => new Date());
  const queueHonesty =
    phase === "ready"
      ? resolveReceiptQueueHonesty({
          shown: items.length,
          pendingTotal,
          fetchLimit: RECEIPT_QUEUE_FETCH_LIMIT,
          ...(hasMore ? { forceMayMore: true } : {}),
        })
      : null;

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    setPhase("loading");
    setError(null);
    setHasMore(false);
    setNextCursor(null);
    const path = withFinanceListScopeQuery(
      `/api/finance/receipts/pending?limit=${RECEIPT_QUEUE_FETCH_LIMIT}`,
      {
        registrationId: registrationFilter,
        tourId: tourFilter,
      }
    );
    void fetchFinanceListWithRetry(path, controller.signal)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`RECEIPTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePendingReceiptsResponse(await response.json());
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setItems(payload.items);
          setNextCursor(payload.nextCursor);
          setHasMore(payload.hasMore);
          setError(null);
          setPhase("ready");
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(toFinanceClientErrorCode(fetchError, "RECEIPTS_FETCH_FAILED"));
        setPhase("error");
      });
    return () => {
      controller.abort();
    };
  }, [fetchNonce, registrationFilter, tourFilter]);

  const refresh = () => setFetchNonce((value) => value + 1);

  const loadMore = () => {
    if (!hasMore || nextCursor === null || loadingMore || loading) {
      return;
    }
    setLoadingMore(true);
    const base = withFinanceListScopeQuery(
      `/api/finance/receipts/pending?limit=${RECEIPT_QUEUE_FETCH_LIMIT}`,
      {
        registrationId: registrationFilter,
        tourId: tourFilter,
      }
    );
    const path = `${base}${base.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(nextCursor)}`;
    void fetch(path, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`RECEIPTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePendingReceiptsResponse(await response.json());
      })
      .then((payload) => {
        setItems((prev) => {
          const seen = new Set(prev.map((row) => row.id));
          const appended = payload.items.filter((row) => !seen.has(row.id));
          return [...prev, ...appended];
        });
        setNextCursor(payload.nextCursor);
        setHasMore(payload.hasMore);
      })
      .catch((fetchError: unknown) => {
        setError(toFinanceClientErrorCode(fetchError, "RECEIPTS_FETCH_FAILED"));
      })
      .finally(() => {
        setLoadingMore(false);
      });
  };
  const emptyPaymentsHref = withFinanceRegistrationQuery(
    "/finance?tab=payments",
    registrationFilter
  );

  const handleReviewed = (result: ReceiptReviewResultBanner) => {
    setLastResult(result);
    refresh();
    router.refresh();
  };

  const resultMessage = (result: ReceiptReviewResultBanner): string => {
    if (result.decision === "reject") {
      return t("resultRejected");
    }
    if (result.bookingPaymentStatus === "paid") {
      return t("resultPaid");
    }
    if (result.bookingPaymentStatus === "partial") {
      const remaining =
        result.remainingMinor !== null
          ? formatMinorAmount(result.remainingMinor, result.currency, locale)
          : "—";
      return t("resultPartial", { remaining });
    }
    if (result.bookingPaymentStatus === "unpaid") {
      return t("resultUnpaid");
    }
    return t("resultUnpaid");
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_RECEIPTS_TEST_IDS.panel}>
      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">{t("listTitle")}</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">{t("reviewRoleHint")}</p>
            <p
              className="text-xs font-normal text-muted-foreground/80"
              data-testid={FINANCE_RECEIPTS_TEST_IDS.primaryPathHint}
            >
              {t("primaryPathHint")}
            </p>
            <p
              className="text-xs font-normal text-muted-foreground/80"
              data-testid={FINANCE_RECEIPTS_TEST_IDS.fifoHint}
            >
              {t("fifoHint")}
            </p>
            {queueHonesty !== null && queueHonesty.shown > 0 ? (
              <div className="space-y-0.5">
                <p
                  className="text-xs font-normal text-muted-foreground"
                  data-testid={FINANCE_RECEIPTS_TEST_IDS.queueHonesty}
                  data-honesty-kind={queueHonesty.kind}
                >
                  {queueHonesty.kind === "shown_of_total"
                    ? t("queueShownOfTotal", {
                        shown: queueHonesty.shown,
                        total: queueHonesty.total,
                      })
                    : t("queueShown", { shown: queueHonesty.shown })}
                </p>
                {queueHonesty.kind === "shown_may_more" ? (
                  <p
                    className="text-xs font-normal text-muted-foreground/80"
                    data-testid={FINANCE_RECEIPTS_TEST_IDS.queueMayMore}
                  >
                    {t("queueMayMore")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {tCommon("refresh")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastResult !== null ? (
            <div
              className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2"
              role="status"
              data-testid={FINANCE_RECEIPTS_TEST_IDS.reviewResult}
              data-decision={lastResult.decision}
              data-booking-payment-status={lastResult.bookingPaymentStatus ?? ""}
            >
              <p className="text-sm font-medium">{resultMessage(lastResult)}</p>
              {lastResult.decision === "reject" &&
              lastResult.registrationId !== undefined &&
              lastResult.registrationId.trim().length >= 32 ? (
                <Link
                  href={withFinanceRegistrationQuery(
                    "/finance?tab=payments",
                    lastResult.registrationId
                  )}
                  className="inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline"
                  data-testid={FINANCE_RECEIPTS_TEST_IDS.reviewResultOpenPayment}
                  data-payment-id={lastResult.paymentId ?? ""}
                >
                  {t("resultRejectedOpenPayment")}
                </Link>
              ) : null}
            </div>
          ) : null}
          {phase === "loading" ? (
            <div className="space-y-3" data-testid={FINANCE_RECEIPTS_TEST_IDS.loading}>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : null}
          {phase === "error" && error !== null ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
          {phase === "ready" && items.length === 0 ? (
            <div className="space-y-2" data-testid={FINANCE_RECEIPTS_TEST_IDS.empty}>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyNextHint")}</p>
              <Link
                href={emptyPaymentsHref}
                className="inline-flex text-sm font-medium text-primary underline-offset-2 hover:underline"
                data-testid={FINANCE_RECEIPTS_TEST_IDS.emptyOpenPayments}
              >
                {t("emptyOpenPayments")}
              </Link>
            </div>
          ) : null}
          {phase === "ready" && items.length > 0 ? (
            <div className="space-y-3">
              <ul className="rounded-md border" data-testid={FINANCE_RECEIPTS_TEST_IDS.list}>
                {items.map((receipt) => (
                  <li key={receipt.id} className="border-b p-3 last:border-b-0 sm:p-4">
                    <FinanceReceiptReviewContent
                      receipt={receipt}
                      canManage={canManage}
                      onReviewed={handleReviewed}
                      now={queueNow}
                    />
                  </li>
                ))}
              </ul>
              {hasMore && nextCursor !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={loadMore}
                  data-testid={FINANCE_RECEIPTS_TEST_IDS.loadMore}
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
