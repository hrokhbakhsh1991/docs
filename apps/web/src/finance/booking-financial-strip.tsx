"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  parseFinancePaymentsListResponse,
  paymentStatusTone,
  type FinancePaymentRow,
} from "@/finance/finance-payments-logic";
import {
  readFinanceRegistrationCache,
  writeFinanceRegistrationCache,
} from "@/finance/finance-registration-fetch-cache";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import { withFinanceRegistrationQuery } from "@/finance/finance-registration-context";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";

const PAYMENTS_CACHE_NS = "finance-strip-payments";

type BookingFinancialStripProps = {
  readonly registrationId: string;
};

function statusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

export function BookingFinancialStrip({ registrationId }: BookingFinancialStripProps) {
  const locale = useLocale() as AppLocale;
  const tCommon = useTranslations("finance.common");
  const tPayments = useTranslations("finance.payments");
  const tOverview = useTranslations("finance.overview");
  const tTabs = useTranslations("finance.commandCenter.tabs");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly FinancePaymentRow[]>([]);

  useEffect(() => {
    const id = registrationId.trim();
    if (id.length < 32) {
      setItems([]);
      setError(null);
      return;
    }
    const cached = readFinanceRegistrationCache<readonly FinancePaymentRow[]>(
      PAYMENTS_CACHE_NS,
      id
    );
    if (cached !== null) {
      setItems(cached);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchFinanceListWithRetry(
      withFinanceRegistrationQuery("/api/finance/payments?limit=5", id),
      controller.signal
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`FINANCE_PAYMENTS_HTTP_${response.status}`);
        }
        return parseFinancePaymentsListResponse(await response.json()).items;
      })
      .then((rows) => {
        if (!controller.signal.aborted) {
          writeFinanceRegistrationCache(PAYMENTS_CACHE_NS, id, rows);
          setItems(rows);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setItems([]);
        setError(toFinanceClientErrorCode(fetchError, "PAYMENTS_FETCH_FAILED"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [registrationId]);

  const paymentsHref = useMemo(
    () => withFinanceRegistrationQuery("/finance?tab=payments", registrationId),
    [registrationId]
  );
  const receiptsHref = useMemo(
    () => withFinanceRegistrationQuery("/finance?tab=receipts", registrationId),
    [registrationId]
  );

  return (
    <section className="space-y-3 rounded-md border bg-muted/20 p-3" data-testid="booking-financial-strip">
      <FinanceInvoiceBalanceCard registrationId={registrationId} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{tPayments("listTitle")}</p>
        <div className="flex items-center gap-3 text-xs">
          <Link className="text-primary underline-offset-2 hover:underline" href={paymentsHref}>
            {tTabs("payments")}
          </Link>
          <Link className="text-primary underline-offset-2 hover:underline" href={receiptsHref}>
            {tTabs("receipts")}
          </Link>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{tCommon("loading")}</p> : null}
      {error !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}
      {!loading && error === null && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tPayments("empty")}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded border bg-background px-2 py-1.5"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {formatMinorAmount(row.amount, row.currency, locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFinanceTimestamp(row.createdAt, locale)}
                </p>
              </div>
              <Badge variant={paymentStatusTone(row.status)}>
                {statusLabel(tPayments, row.status)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <Link className="inline-block text-xs text-primary underline-offset-2 hover:underline" href={paymentsHref}>
        {tOverview("viewDetails")}
      </Link>
    </section>
  );
}
