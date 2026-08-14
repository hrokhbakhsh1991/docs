"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FINANCE_EXCEPTION_TYPE,
  FINANCE_EXCEPTIONS_TEST_IDS,
  exceptionMeaningI18nKey,
  exceptionOutstandingHref,
  exceptionShowsOutstandingLink,
  exceptionTypeI18nKey,
  hasExceptionReceiptsHref,
  parseFinanceExceptionsResponse,
  toExceptionRegistrationContext,
  type FinanceExceptionListItem,
} from "@/finance/finance-exceptions-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

export type FinanceExceptionsPanelProps = {
  readonly items: readonly FinanceExceptionListItem[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
};

function resolveExceptionPaymentStatusLabel(
  status: FinanceExceptionListItem["payment"]["status"],
  tPayments: ReturnType<typeof useTranslations>
): string {
  if (status === "Pending") {
    return tPayments("status.Pending");
  }
  if (status === "Cancelled") {
    return tPayments("status.Cancelled");
  }
  return status;
}

/**
 * PR23-C3 — read-only exception discovery. No finance mutations.
 */
export function FinanceExceptionsPanel({
  items,
  loading,
  error,
  onRefresh,
}: FinanceExceptionsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.exceptions");
  const tPayments = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");

  return (
    <Card
      data-operator-surface="card"
      className="shadow-sm"
      data-testid={FINANCE_EXCEPTIONS_TEST_IDS.panel}
    >
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <p className="text-xs font-normal text-muted-foreground">{t("subtitle")}</p>
          <p className="text-xs font-medium text-foreground">{t("needsActionBadge")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          data-testid={FINANCE_EXCEPTIONS_TEST_IDS.refresh}
        >
          {tCommon("refresh")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div data-testid={FINANCE_EXCEPTIONS_TEST_IDS.loading} className="space-y-2">
            <OperatorSkeleton size="user-card" />
            <OperatorSkeleton size="user-card" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-2" data-testid={FINANCE_EXCEPTIONS_TEST_IDS.error} role="alert">
            <p className="text-sm text-destructive">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              data-testid={FINANCE_EXCEPTIONS_TEST_IDS.retry}
            >
              {t("retry")}
            </Button>
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={FINANCE_EXCEPTIONS_TEST_IDS.empty}
          >
            {t("empty")}
          </p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul
            className="divide-y rounded-md border"
            data-testid={FINANCE_EXCEPTIONS_TEST_IDS.list}
          >
            {items.map((item) => {
              const context = toExceptionRegistrationContext(item);
              const showReceipts =
                item.type === FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT &&
                hasExceptionReceiptsHref(item);
              const paymentStatusLabel = resolveExceptionPaymentStatusLabel(
                item.payment.status,
                tPayments
              );
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between"
                  data-testid={FINANCE_EXCEPTIONS_TEST_IDS.item}
                  data-exception-type={item.type}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" data-testid={FINANCE_EXCEPTIONS_TEST_IDS.type}>
                        {t(exceptionTypeI18nKey(item.type))}
                      </Badge>
                      <span className="text-sm font-medium">
                        {formatMinorAmount(item.payment.amount, item.payment.currency, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground">{paymentStatusLabel}</span>
                    </div>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid={FINANCE_EXCEPTIONS_TEST_IDS.meaning}
                    >
                      {t(exceptionMeaningI18nKey(item.type))}
                    </p>
                    <FinanceRegistrationIdentity
                      registrationId={item.registrationId}
                      context={context}
                      density="compact"
                    />
                    {item.reason !== null ? (
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={FINANCE_EXCEPTIONS_TEST_IDS.reason}
                      >
                        {t("reasonLabel")}: {item.reason}
                      </p>
                    ) : null}
                    {item.balanceDueMinor !== null ? (
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={FINANCE_EXCEPTIONS_TEST_IDS.balance}
                      >
                        {t("balanceDue")}:{" "}
                        {formatMinorAmount(item.balanceDueMinor, item.payment.currency, locale)}
                      </p>
                    ) : null}
                    {item.occurredAt.length > 0 ? (
                      <p
                        className="text-xs text-muted-foreground"
                        data-testid={FINANCE_EXCEPTIONS_TEST_IDS.occurredAt}
                      >
                        {t("occurredAt")}: {formatFinanceTimestamp(item.occurredAt, locale)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {exceptionShowsOutstandingLink(item) ? (
                      <Link
                        href={exceptionOutstandingHref(item.registrationId)}
                        className="text-sm font-medium text-primary hover:underline"
                        data-testid={FINANCE_EXCEPTIONS_TEST_IDS.openOutstanding}
                      >
                        {t("openOutstanding")}
                      </Link>
                    ) : null}
                    <Link
                      href={item.href.payments}
                      className={
                        exceptionShowsOutstandingLink(item)
                          ? "text-sm text-muted-foreground hover:underline"
                          : "text-sm font-medium text-primary hover:underline"
                      }
                      data-testid={FINANCE_EXCEPTIONS_TEST_IDS.openPayments}
                    >
                      {t("openPayments")}
                    </Link>
                    {showReceipts && item.href.receipts !== undefined ? (
                      <Link
                        href={item.href.receipts}
                        className="text-sm text-muted-foreground hover:underline"
                        data-testid={FINANCE_EXCEPTIONS_TEST_IDS.openReceipts}
                      >
                        {t("openReceipts")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Overview mount — fetches exception API only (no client-side exception rules).
 */
export function FinanceExceptionsFollowUpSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly FinanceExceptionListItem[]>([]);
  const [fetchNonce, setFetchNonce] = useState(0);

  const onRefresh = useCallback(() => {
    setFetchNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/exceptions?limit=50", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("EXCEPTIONS_FETCH_FAILED");
        }
        return parseFinanceExceptionsResponse(await response.json());
      })
      .then((page) => {
        if (!cancelled) {
          setItems(page.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(toFinanceClientErrorCode(fetchError, "EXCEPTIONS_FETCH_FAILED"));
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

  return (
    <FinanceExceptionsPanel
      items={items}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
    />
  );
}
