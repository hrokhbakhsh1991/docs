"use client";

import { createClientSafeUuid } from "@app-tour/draft-engine";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchRegistrationInvoice,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  buildReviewReceiptRequestBody,
  classifyReceiptAmountAgainstRemaining,
  remainingAfterApproveMinor,
  resolveReceiptAgingBandFromCreatedAt,
  resolveReceiptWaitRelative,
  type FinancePendingReceipt,
  type ReceiptAgingBand,
  type ReceiptAmountFit,
  type ReceiptWaitRelative,
  validateReviewReceiptForm,
  parseFinanceReceiptReviewResponse,
} from "@/finance/finance-receipts-logic";
import { ReceiptProofPreview } from "@/finance/receipt-proof-preview";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import { emitFinanceCaseCommandUiTelemetry } from "@/finance/finance-case-command-ui-telemetry";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";
import { cn } from "@/lib/utils";

export type ReceiptReviewResultBanner = {
  readonly decision: "approve" | "reject";
  readonly bookingPaymentStatus?: "unpaid" | "partial" | "paid";
  readonly remainingMinor: string | null;
  readonly currency: string;
  readonly registrationId?: string;
  readonly paymentId?: string;
};

function resolveFinanceReceiptStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

function resolvePaymentStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

function formatReceiptWaitRelativeLabel(parts: ReceiptWaitRelative, locale: AppLocale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "fa" ? "fa" : "en", {
    numeric: "auto",
  });
  return rtf.format(parts.value, parts.unit);
}

function agingBandLabel(
  band: ReceiptAgingBand,
  t: (key: "agingFresh" | "agingWaiting" | "agingLonger") => string
): string {
  if (band === "fresh") {
    return t("agingFresh");
  }
  if (band === "waiting") {
    return t("agingWaiting");
  }
  return t("agingLonger");
}

function amountFitLabels(
  fit: ReceiptAmountFit,
  t: (key: string) => string
): { fitLabel: string; consequence: string } | null {
  if (fit === "under") {
    return { fitLabel: t("amountFitUnder"), consequence: t("consequenceUnder") };
  }
  if (fit === "exact") {
    return { fitLabel: t("amountFitExact"), consequence: t("consequenceExact") };
  }
  if (fit === "over") {
    return { fitLabel: t("amountFitOver"), consequence: t("consequenceOver") };
  }
  return null;
}

function ReceiptMoneyGlance({
  invoice,
  paymentAmount,
  currency,
  amountFit,
}: {
  readonly invoice: RegistrationInvoice | null;
  readonly paymentAmount: string | null;
  readonly currency: string;
  readonly amountFit: ReceiptAmountFit;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.receipts");
  const labels = amountFitLabels(amountFit, t);

  const afterPreview =
    invoice !== null && paymentAmount !== null
      ? remainingAfterApproveMinor(paymentAmount, invoice.balanceDueMinor)
      : null;

  return (
    <div
      className="space-y-2 rounded-md border bg-muted/20 px-3 py-2"
      data-testid={FINANCE_RECEIPTS_TEST_IDS.financialContext}
    >
      {invoice !== null ? (
        <div className="grid grid-cols-3 gap-2 text-start" dir="ltr">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("invoiceTotalShort")}</p>
            <p className="text-sm font-medium tabular-nums">
              {formatMinorAmount(invoice.invoiceTotalMinor, invoice.currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("paidShort")}</p>
            <p className="text-sm font-medium tabular-nums">
              {formatMinorAmount(invoice.paidAmountMinor, invoice.currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("remainingShort")}</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatMinorAmount(invoice.balanceDueMinor, invoice.currency, locale)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("invoiceUnavailable")}</p>
      )}

      {paymentAmount !== null ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border/60 pt-2">
          <p
            className="text-base font-semibold tabular-nums"
            data-testid={FINANCE_RECEIPTS_TEST_IDS.submittedAmount}
          >
            <span className="me-1 text-xs font-normal text-muted-foreground">
              {t("submittedAmount")}
            </span>
            {formatMinorAmount(paymentAmount, currency, locale)}
          </p>
          {labels !== null ? (
            <Badge
              variant={amountFit === "over" ? "destructive" : "secondary"}
              data-testid={FINANCE_RECEIPTS_TEST_IDS.amountFit}
              data-amount-fit={amountFit}
            >
              {labels.fitLabel}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {amountFit === "exact" ? (
        <p
          className="text-xs font-medium text-foreground"
          data-testid={FINANCE_RECEIPTS_TEST_IDS.afterApprovePreview}
        >
          {t("afterApprovePaid")}
        </p>
      ) : null}
      {amountFit === "under" && afterPreview !== null ? (
        <p
          className="text-xs font-medium text-foreground"
          data-testid={FINANCE_RECEIPTS_TEST_IDS.afterApprovePreview}
        >
          {t("afterApproveRemaining", {
            remaining: formatMinorAmount(afterPreview, currency, locale),
          })}
        </p>
      ) : null}
    </div>
  );
}

export type FinanceReceiptReviewContentProps = {
  readonly receipt: FinancePendingReceipt;
  readonly canManage: boolean;
  readonly onReviewed: (result: ReceiptReviewResultBanner) => void;
  readonly now: Date;
  readonly showIdentity?: boolean;
  readonly className?: string;
};

export function FinanceReceiptReviewContent({
  receipt,
  canManage,
  onReviewed,
  now,
  showIdentity = true,
  className,
}: FinanceReceiptReviewContentProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.receipts");
  const tPayments = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const [reviewNote, setReviewNote] = useState("");
  const [busyDecision, setBusyDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);
  const [invoiceLoaded, setInvoiceLoaded] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  const registrationId = receipt.payment?.registrationId?.trim() ?? "";
  const agingBand = resolveReceiptAgingBandFromCreatedAt(receipt.createdAt, now);
  const waitRelative = resolveReceiptWaitRelative(receipt.createdAt, now);

  useEffect(() => {
    if (registrationId.length < 32) {
      setInvoice(null);
      setInvoiceLoaded(true);
      return;
    }
    let cancelled = false;
    setInvoiceLoaded(false);
    void fetchRegistrationInvoice(registrationId)
      .then((payload) => {
        if (!cancelled) {
          setInvoice(payload);
          setInvoiceLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInvoice(null);
          setInvoiceLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  const amountFit =
    receipt.payment !== null
      ? classifyReceiptAmountAgainstRemaining(
          receipt.payment.amount,
          invoice?.balanceDueMinor ?? null
        )
      : "unknown";
  const labels = amountFitLabels(amountFit, t);

  const submitReview = async (decision: "approve" | "reject") => {
    if (!canManage || busyDecision !== null) {
      return;
    }
    setError(null);
    const validated = validateReviewReceiptForm({ decision, reviewNote });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    setBusyDecision(decision);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (validated.value.decision === "approve") {
        headers["Idempotency-Key"] = createClientSafeUuid();
      }
      const response = await fetch(`/api/finance/receipts/${receipt.id}/review`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(buildReviewReceiptRequestBody(validated.value)),
      });
      const payload = parseFinanceReceiptReviewResponse(await response.json().catch(() => null));
      if (!response.ok) {
        emitFinanceCaseCommandUiTelemetry({
          name: "classic_review_submitted",
          receiptId: receipt.id,
          decision: validated.value.decision,
          ok: false,
        });
        throw new Error(`RECEIPT_REVIEW_HTTP_${response.status}`);
      }
      emitFinanceCaseCommandUiTelemetry({
        name: "classic_review_submitted",
        receiptId: receipt.id,
        decision: validated.value.decision,
        ok: true,
      });
      const registrationIdForCache =
        receipt.payment?.registrationId ?? receipt.registrationContext?.registrationId ?? "";
      if (registrationIdForCache.trim().length >= 32) {
        invalidateFinanceRegistrationCaches(registrationIdForCache);
      }
      const currency = receipt.payment?.currency ?? invoice?.currency ?? "";
      let remainingMinor: string | null = null;
      if (validated.value.decision === "approve" && receipt.payment !== null && invoice !== null) {
        remainingMinor = remainingAfterApproveMinor(
          receipt.payment.amount,
          invoice.balanceDueMinor
        );
      }
      if (payload?.bookingPaymentStatus === "paid") {
        remainingMinor = "0";
      }
      onReviewed({
        decision: validated.value.decision,
        bookingPaymentStatus: payload?.bookingPaymentStatus,
        remainingMinor,
        currency,
        registrationId:
          receipt.payment?.registrationId ??
          receipt.registrationContext?.registrationId ??
          undefined,
        paymentId: receipt.paymentId.trim().length > 0 ? receipt.paymentId : receipt.payment?.id,
      });
    } catch (reviewError: unknown) {
      setError(toFinanceClientErrorCode(reviewError, "REVIEW_RECEIPT_FAILED"));
    } finally {
      setBusyDecision(null);
    }
  };

  const currency = receipt.payment?.currency ?? invoice?.currency ?? "";
  const busy = busyDecision !== null;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          {showIdentity && receipt.payment ? (
            <FinanceRegistrationIdentity
              registrationId={receipt.payment.registrationId}
              context={receipt.registrationContext}
            />
          ) : null}
          {receipt.note ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{receipt.note}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            data-testid={FINANCE_RECEIPTS_TEST_IDS.receiptStatus}
            data-receipt-status={receipt.status}
          >
            {resolveFinanceReceiptStatusLabel(t, receipt.status)}
          </Badge>
          {receipt.payment ? (
            <Badge
              variant="secondary"
              data-testid={FINANCE_RECEIPTS_TEST_IDS.paymentStatus}
              data-payment-status={receipt.payment.status}
            >
              {resolvePaymentStatusLabel(tPayments, receipt.payment.status)}
            </Badge>
          ) : null}
        </div>
      </div>

      {registrationId.length >= 32 ? (
        invoiceLoaded ? (
          <ReceiptMoneyGlance
            invoice={invoice}
            paymentAmount={receipt.payment?.amount ?? null}
            currency={currency}
            amountFit={amountFit}
          />
        ) : (
          <Skeleton
            className="h-20 w-full"
            data-testid={FINANCE_RECEIPTS_TEST_IDS.financialContext}
          />
        )
      ) : receipt.payment !== null ? (
        <p
          className="text-base font-semibold tabular-nums"
          data-testid={FINANCE_RECEIPTS_TEST_IDS.submittedAmount}
        >
          <span className="me-1 text-xs font-normal text-muted-foreground">
            {t("submittedAmount")}
          </span>
          {formatMinorAmount(receipt.payment.amount, currency, locale)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          data-testid={FINANCE_RECEIPTS_TEST_IDS.proofToggle}
          aria-expanded={proofOpen}
          onClick={() => setProofOpen((open) => !open)}
        >
          {proofOpen ? t("hideProof") : t("showProof")}
        </button>
        <span data-testid={FINANCE_RECEIPTS_TEST_IDS.submittedAt}>
          {t("submittedAt")}: {formatFinanceTimestamp(receipt.createdAt, locale)}
        </span>
        {waitRelative !== null ? (
          <span data-testid={FINANCE_RECEIPTS_TEST_IDS.waitRelative}>
            {formatReceiptWaitRelativeLabel(waitRelative, locale)}
          </span>
        ) : null}
        {agingBand !== null ? (
          <span data-testid={FINANCE_RECEIPTS_TEST_IDS.agingBand} data-aging-band={agingBand}>
            {agingBandLabel(agingBand, t)}
          </span>
        ) : null}
        {receipt.payment ? (
          <span>
            {t("paymentMethod")}: {receipt.payment.method}
          </span>
        ) : null}
      </div>

      <ReceiptProofPreview receiptId={receipt.id} fileKey={receipt.fileKey} expanded={proofOpen} />

      {canManage ? (
        <div
          className="space-y-2 border-t border-border/50 pt-2"
          data-testid={FINANCE_RECEIPTS_TEST_IDS.reviewForm}
        >
          {labels !== null ? (
            <p
              className="text-sm font-medium text-foreground"
              data-testid={FINANCE_RECEIPTS_TEST_IDS.approveConsequence}
            >
              {labels.consequence}
            </p>
          ) : null}
          <Label htmlFor={`review-note-${receipt.id}`} className="text-xs text-muted-foreground">
            {tCommon("reviewNote")}
          </Label>
          <Input
            id={`review-note-${receipt.id}`}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder={t("reviewPlaceholder")}
            disabled={busy}
            className="h-8"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submitReview("approve")}
            >
              {busyDecision === "approve" ? t("approving") : tCommon("approve")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => void submitReview("reject")}
            >
              {busyDecision === "reject" ? t("rejecting") : tCommon("reject")}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
