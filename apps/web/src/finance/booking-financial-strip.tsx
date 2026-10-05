"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  BOOKING_FINANCIAL_STRIP_TEST_IDS,
  hasInvoiceRemainingBalance,
  hasOpenPendingManualPayment,
  resolveStripBookingSettlementSummary,
  resolveStripRefundStatus,
  resolveStripNextStep,
  type StripBookingPaymentStatus,
  type StripBookingSettlementSummary,
  type StripFinancialDisplayState,
  type StripRefundStatus,
  type StripNextStepPlan,
} from "@/finance/booking-financial-strip-logic";
import { buildFinanceCommercialMeaningHref } from "@/finance/finance-commercial-meaning-contract";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import {
  buildInvoiceLookupPath,
  parseRegistrationInvoice,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  parseFinancePaymentsListResponse,
  paymentStatusTone,
  type FinancePaymentRow,
} from "@/finance/finance-payments-logic";
import { parseFinancePendingReceiptsResponse } from "@/finance/finance-receipts-logic";
import {
  FINANCE_REGISTRATION_CACHE_NS,
  readFinanceRegistrationCache,
  writeFinanceRegistrationCache,
} from "@/finance/finance-registration-fetch-cache";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import {
  withFinanceListScopeQuery,
  withFinanceRegistrationQuery,
} from "@/finance/finance-registration-context";
import { parseFinanceRefundsResponse } from "@/finance/finance-refunds-logic";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";

type BookingFinancialStripProps = {
  readonly registrationId: string;
  readonly bookingPaymentStatus?: StripBookingPaymentStatus;
  readonly bookingStatus?: string;
  readonly financialDisplayState?: StripFinancialDisplayState | null;
  readonly refreshKey?: string | number;
};

type StripPendingReceiptCache = {
  readonly hasPendingReceipt: boolean;
};

type StripInvoiceCachePayload = {
  readonly invoice: RegistrationInvoice | null;
};

function statusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

function settlementSummaryCopy(
  kind: StripBookingSettlementSummary,
  t: (key: string) => string
): string {
  switch (kind) {
    case "booking_paid":
      return t("stripBookingSettlementPaid");
    case "booking_waived":
      return t("stripBookingSettlementWaived");
    case "booking_partial_recorded":
      return t("stripBookingSettlementPartialRecorded");
    case "booking_partial_pending":
      return t("stripBookingSettlementPartialPending");
    case "booking_unpaid_pending":
      return t("stripBookingSettlementUnpaidPending");
    case "booking_unpaid":
      return t("stripBookingSettlementUnpaid");
    case "booking_partial":
      return t("stripBookingSettlementPartial");
    case "booking_cancelled":
      return t("stripBookingSettlementCancelled");
    case "booking_refund_pending":
      return t("stripBookingSettlementRefundPending");
    case "booking_refunded":
      return t("stripBookingSettlementRefunded");
    default:
      return t("stripBookingSettlementPartial");
  }
}

async function fetchRegistrationRefundStatus(
  registrationId: string,
  signal: AbortSignal
): Promise<StripRefundStatus | null> {
  const statuses: StripRefundStatus[] = [];
  let cursor: string | null = null;
  const seenCursors = new Set<string>();
  do {
    const cursorQuery = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
    const response = await fetchFinanceListWithRetry(
      withFinanceListScopeQuery(`/api/finance/refunds?limit=100${cursorQuery}`, {
        registrationId,
      }),
      signal
    );
    if (!response.ok) return null;
    const page = parseFinanceRefundsResponse(await response.json());
    statuses.push(...page.items.map((row) => row.status));
    if (!page.hasMore || page.nextCursor === null || seenCursors.has(page.nextCursor)) {
      break;
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (!signal.aborted);
  return resolveStripRefundStatus(statuses);
}

function paymentsNextStepHintKey(plan: StripNextStepPlan): string {
  switch (plan.reason) {
    case "pending_payment_with_receipt":
      return "stripNextStepPaymentsNeutralHint";
    case "remaining_balance":
      return "stripNextStepPaymentsBalanceHint";
    default:
      return "stripNextStepPaymentsHint";
  }
}

export function BookingFinancialStrip({
  registrationId,
  bookingPaymentStatus,
  bookingStatus = "",
  financialDisplayState = null,
  refreshKey,
}: BookingFinancialStripProps) {
  const locale = useLocale() as AppLocale;
  const tCommon = useTranslations("finance.common");
  const tPayments = useTranslations("finance.payments");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const isWaivedBooking = financialDisplayState?.trim().toUpperCase() === "WAIVED";
  const isTerminalBooking = bookingStatus === "cancelled" || bookingStatus === "rejected";
  const isSettledBooking =
    (bookingPaymentStatus === "paid" && !isTerminalBooking) || isWaivedBooking;
  const [loading, setLoading] = useState(() => registrationId.trim().length >= 32);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<readonly FinancePaymentRow[]>([]);
  const [balanceDueMinor, setBalanceDueMinor] = useState<string | null>(null);
  const [hasPendingReceipt, setHasPendingReceipt] = useState(false);
  const [refundStatus, setRefundStatus] = useState<StripRefundStatus | null>(null);

  useEffect(() => {
    const id = registrationId.trim();
    if (financialDisplayState?.trim().toUpperCase() === "WAIVED") {
      setItems([]);
      setBalanceDueMinor(null);
      setHasPendingReceipt(false);
      setRefundStatus(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (id.length < 32) {
      setItems([]);
      setBalanceDueMinor(null);
      setHasPendingReceipt(false);
      setRefundStatus(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cachedPayments = readFinanceRegistrationCache<readonly FinancePaymentRow[]>(
      FINANCE_REGISTRATION_CACHE_NS.stripPayments,
      id
    );
    const cachedInvoice = readFinanceRegistrationCache<StripInvoiceCachePayload>(
      FINANCE_REGISTRATION_CACHE_NS.invoiceBalance,
      id
    );
    const cachedReceipt = readFinanceRegistrationCache<StripPendingReceiptCache>(
      FINANCE_REGISTRATION_CACHE_NS.stripPendingReceipt,
      id
    );

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    if (cachedPayments !== null) {
      setItems(cachedPayments);
    }
    if (cachedInvoice !== null) {
      setBalanceDueMinor(cachedInvoice.invoice?.balanceDueMinor ?? null);
    }
    if (cachedReceipt !== null) {
      setHasPendingReceipt(cachedReceipt.hasPendingReceipt);
    }

    const paymentsReady =
      cachedPayments !== null
        ? Promise.resolve(cachedPayments)
        : fetchFinanceListWithRetry(
            withFinanceRegistrationQuery("/api/finance/payments?limit=5", id),
            controller.signal
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(`FINANCE_PAYMENTS_HTTP_${response.status}`);
            }
            return parseFinancePaymentsListResponse(await response.json()).items;
          });

    const invoiceReady =
      cachedInvoice !== null
        ? Promise.resolve(cachedInvoice.invoice)
        : fetch(buildInvoiceLookupPath(id), { cache: "no-store", signal: controller.signal })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`INVOICE_HTTP_${response.status}`);
              }
              return parseRegistrationInvoice(await response.json());
            })
            .catch(() => null);

    const receiptReady =
      cachedReceipt !== null
        ? Promise.resolve(cachedReceipt.hasPendingReceipt)
        : fetchFinanceListWithRetry(
            withFinanceListScopeQuery("/api/finance/receipts/pending?limit=5", {
              registrationId: id,
            }),
            controller.signal
          )
            .then(async (response) => {
              if (!response.ok) {
                return false;
              }
              return parseFinancePendingReceiptsResponse(await response.json()).items.length > 0;
            })
            .catch(() => false);

    const refundReady = fetchRegistrationRefundStatus(id, controller.signal).catch(() => null);

    void Promise.all([paymentsReady, invoiceReady, receiptReady, refundReady])
      .then(([rows, invoice, pendingReceipt, refund]) => {
        if (controller.signal.aborted) {
          return;
        }
        writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.stripPayments, id, rows);
        writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, id, {
          invoice,
        });
        writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.stripPendingReceipt, id, {
          hasPendingReceipt: pendingReceipt,
        });
        setItems(rows);
        setBalanceDueMinor(invoice?.balanceDueMinor ?? null);
        setHasPendingReceipt(pendingReceipt);
        setRefundStatus(refund);
        setError(null);
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
  }, [bookingStatus, financialDisplayState, refreshKey, registrationId]);

  const paymentsHref = useMemo(
    () => withFinanceRegistrationQuery("/finance?tab=payments", registrationId),
    [registrationId]
  );
  const receiptsHref = useMemo(
    () => withFinanceRegistrationQuery("/finance?tab=receipts", registrationId),
    [registrationId]
  );
  const meaningHref = useMemo(
    () => buildFinanceCommercialMeaningHref(registrationId),
    [registrationId]
  );

  const settlementSummary = useMemo(() => {
    if (loading) {
      return null;
    }
    return resolveStripBookingSettlementSummary({
      bookingPaymentStatus,
      bookingStatus,
      financialDisplayState,
      refundStatus,
      items,
    });
  }, [bookingPaymentStatus, bookingStatus, financialDisplayState, items, loading, refundStatus]);

  const nextStep = useMemo(() => {
    if (loading) {
      return null;
    }
    if (
      bookingPaymentStatus !== "unpaid" &&
      bookingPaymentStatus !== "partial" &&
      bookingPaymentStatus !== "paid"
    ) {
      return null;
    }
    return resolveStripNextStep({
      bookingStatus,
      bookingPaymentStatus,
      financialDisplayState,
      hasOpenPendingPayment: hasOpenPendingManualPayment(items),
      hasPendingReceipt,
      hasRemainingBalance: hasInvoiceRemainingBalance(balanceDueMinor),
      registrationId,
    });
  }, [
    balanceDueMinor,
    bookingPaymentStatus,
    bookingStatus,
    financialDisplayState,
    hasPendingReceipt,
    items,
    loading,
    registrationId,
  ]);

  return (
    <section
      className="space-y-3 rounded-md border bg-muted/20 p-3"
      data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.strip}
    >
      {!isWaivedBooking ? (
        <FinanceInvoiceBalanceCard
          registrationId={registrationId}
          refreshKey={refreshKey}
          closed={isTerminalBooking}
        />
      ) : null}

      {settlementSummary !== null ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.settlementBridge}
          data-bridge-kind={settlementSummary}
        >
          {settlementSummaryCopy(settlementSummary, tPayments)}
        </p>
      ) : null}

      {!isWaivedBooking ? (
        <p
          className="text-sm font-medium"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.latestPaymentsTitle}
        >
          {tPayments("stripLatestPaymentsTitle")}
        </p>
      ) : null}

      {!isWaivedBooking && loading ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : null}
      {!isWaivedBooking && error !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}
      {!isWaivedBooking && !loading && error === null && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isTerminalBooking ? tPayments("emptyCancelled") : tPayments("empty")}
        </p>
      ) : null}

      {!isWaivedBooking && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium tabular-nums">
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

      {/* PR22-B: settled = read-only; no payment-management primary CTA. */}
      {!loading && isSettledBooking ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.settledReadOnly}
        >
          {tPayments("stripSettledReadOnly")}
        </p>
      ) : null}

      {/* Primary next-step only (PR22-A order + PR22-B single primary). */}
      {!isWaivedBooking && nextStep !== null && nextStep.tab === "receipts" ? (
        <p
          className="rounded-md border border-primary/30 bg-muted/40 p-2.5 text-sm text-foreground"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.nextStep}
          data-next-tab="receipts"
          data-next-reason={nextStep.reason}
          data-cta-tier="primary"
        >
          {tPayments("stripNextStepReceiptsHint")}{" "}
          <Link
            href={nextStep.href}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {tPayments("stripNextStepContinueReceipts")}
          </Link>
        </p>
      ) : null}

      {!isWaivedBooking && nextStep !== null && nextStep.tab === "payments" ? (
        <p
          className="rounded-md border border-primary/30 bg-muted/40 p-2.5 text-sm text-foreground"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.nextStep}
          data-next-tab="payments"
          data-next-reason={nextStep.reason}
          data-cta-tier="primary"
        >
          {tPayments(paymentsNextStepHintKey(nextStep))}{" "}
          <Link
            href={nextStep.href}
            className="font-semibold text-primary underline-offset-4 hover:underline"
            data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.openPayments}
          >
            {tPayments("stripNextStepOpenPayments")}
          </Link>
        </p>
      ) : null}

      {/* Secondary + tertiary nav — never styled as equal primary actions. */}
      {!isWaivedBooking && !loading ? (
        <nav
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
          data-testid={BOOKING_FINANCIAL_STRIP_TEST_IDS.secondaryNav}
          aria-label={tPayments("stripActionNavAria")}
        >
          {nextStep?.tab === "payments" ? (
            <Link
              href={receiptsHref}
              className="underline-offset-2 hover:underline"
              data-nav-tier="secondary"
            >
              {tPayments("stripSecondaryReceipts")}
            </Link>
          ) : null}
          {nextStep?.tab === "receipts" || nextStep === null ? (
            <Link
              href={paymentsHref}
              className="underline-offset-2 hover:underline"
              data-nav-tier="secondary"
              data-testid="booking-financial-strip-payment-history"
            >
              {tPayments("stripPaymentHistory")}
            </Link>
          ) : null}
          <Link
            href={meaningHref}
            className="underline-offset-2 hover:underline"
            data-testid="booking-strip-commercial-meaning-link"
            data-nav-id={BOOKING_FINANCIAL_STRIP_TEST_IDS.tertiaryMeaning}
            data-nav-tier="tertiary"
          >
            {tPayments("stripTertiaryMeaning")}
          </Link>
        </nav>
      ) : null}
    </section>
  );
}
