"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import {
  fetchRegistrationInvoice,
  resolveSuggestedPaymentAmountMinor,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import {
  buildCreateManualPaymentRequestBody,
  buildFinancePaymentReceiptsHref,
  buildSubmitReceiptRequestBody,
  createFinanceIdempotencyKey,
  type FinanceRegistrationPaymentActionEvent,
  FINANCE_PAYMENTS_TEST_IDS,
  parseFinanceManualPaymentCreateResponse,
  parseFinanceReceiptCreateResponse,
  uploadFinanceReceiptProof,
  validateCreateManualPaymentForm,
  validateSubmitReceiptForm,
  type FinancePaymentRow,
  type SubmitReceiptFormState,
} from "@/finance/finance-payments-logic";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";
import { cn } from "@/lib/utils";

type FinanceRegistrationPaymentActionsProps = {
  readonly registrationId: string;
  readonly canManage: boolean;
  readonly onChanged?: (event: FinanceRegistrationPaymentActionEvent) => void;
  readonly className?: string;
  readonly showActionBanner?: boolean;
};

type PaymentActionBanner =
  | {
      readonly kind: "manual_payment_created";
      readonly payment: FinancePaymentRow;
    }
  | {
      readonly kind: "receipt_submitted";
      readonly registrationId: string;
      readonly paymentId: string;
      readonly receiptId: string | null;
    };

const EMPTY_RECEIPT_FORM: SubmitReceiptFormState = {
  paymentId: "",
  fileKey: "",
  note: "",
};

const DEFAULT_PAYMENT_CURRENCY = "";

export function FinanceRegistrationPaymentActions({
  registrationId,
  canManage,
  onChanged,
  className,
  showActionBanner = true,
}: FinanceRegistrationPaymentActionsProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const normalizedRegistrationId = registrationId.trim();
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_PAYMENT_CURRENCY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBanner, setActionBanner] = useState<PaymentActionBanner | null>(null);
  const [receiptForm, setReceiptForm] = useState<SubmitReceiptFormState>(EMPTY_RECEIPT_FORM);
  const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptUploadBusy, setReceiptUploadBusy] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [invoiceLoaded, setInvoiceLoaded] = useState(false);
  const amountPrefilledRef = useRef<string | null>(null);

  useEffect(() => {
    setAmount("");
    setCurrency(DEFAULT_PAYMENT_CURRENCY);
    setFormError(null);
    setActionBanner(null);
    setReceiptForm(EMPTY_RECEIPT_FORM);
    setReceiptFormError(null);
    setReceiptUploadError(null);
    setReceiptUploadBusy(false);
    setAdvancedOpen(false);
    amountPrefilledRef.current = null;
  }, [normalizedRegistrationId]);

  useEffect(() => {
    if (normalizedRegistrationId.length < 32) {
      setInvoice(null);
      setInvoiceLoaded(true);
      return;
    }
    let cancelled = false;
    setInvoiceLoaded(false);
    void fetchRegistrationInvoice(normalizedRegistrationId)
      .then((nextInvoice) => {
        if (cancelled) {
          return;
        }
        setInvoice(nextInvoice);
        setInvoiceLoaded(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setInvoice(null);
        setInvoiceLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [normalizedRegistrationId]);

  useEffect(() => {
    if (invoice === null || amount.trim().length > 0) {
      return;
    }
    if (amountPrefilledRef.current === normalizedRegistrationId) {
      return;
    }
    amountPrefilledRef.current = normalizedRegistrationId;
    setAmount(resolveSuggestedPaymentAmountMinor(invoice));
    setCurrency(invoice.currency);
  }, [amount, invoice, normalizedRegistrationId]);

  const handleCreateManualPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    setActionBanner(null);
    const validated = validateCreateManualPaymentForm({
      registrationId: normalizedRegistrationId,
      amount,
      currency,
    });
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/finance/payments/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createFinanceIdempotencyKey("workspace-manual-pay"),
        },
        body: JSON.stringify(buildCreateManualPaymentRequestBody(validated.value)),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`MANUAL_PAYMENT_HTTP_${response.status}`);
      }
      const created =
        parseFinanceManualPaymentCreateResponse(raw) ??
        ({
          id: "",
          registrationId: normalizedRegistrationId,
          amount: validated.value.amount,
          currency: validated.value.currency,
          method: "Manual",
          status: "Pending",
          provider: "manual",
          paidAt: null,
          createdAt: new Date().toISOString(),
          registrationContext: null,
        } satisfies FinancePaymentRow);
      invalidateFinanceRegistrationCaches(normalizedRegistrationId);
      setActionBanner({
        kind: "manual_payment_created",
        payment: created,
      });
      setReceiptForm((current) => ({
        ...current,
        paymentId: created.id.length > 0 ? created.id : current.paymentId,
      }));
      setAdvancedOpen(true);
      setAmount("");
      amountPrefilledRef.current = null;
      onChanged?.({
        kind: "manual_payment_created",
        registrationId: normalizedRegistrationId,
        paymentId: created.id.length > 0 ? created.id : null,
      });
    } catch (error: unknown) {
      setFormError(toFinanceClientErrorCode(error, "MANUAL_PAYMENT_FAILED"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setReceiptFormError(null);
    setActionBanner(null);
    const validated = validateSubmitReceiptForm(receiptForm);
    if (!validated.ok) {
      setReceiptFormError(validated.error);
      return;
    }
    setReceiptSaving(true);
    try {
      const response = await fetch("/api/finance/receipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createFinanceIdempotencyKey("workspace-submit-receipt"),
        },
        body: JSON.stringify(buildSubmitReceiptRequestBody(validated.value)),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`SUBMIT_RECEIPT_HTTP_${response.status}`);
      }
      const createdReceipt = parseFinanceReceiptCreateResponse(raw);
      invalidateFinanceRegistrationCaches(normalizedRegistrationId);
      setReceiptForm(EMPTY_RECEIPT_FORM);
      setActionBanner({
        kind: "receipt_submitted",
        registrationId: normalizedRegistrationId,
        paymentId: validated.value.paymentId,
        receiptId: createdReceipt?.id ?? null,
      });
      onChanged?.({
        kind: "receipt_submitted",
        registrationId: normalizedRegistrationId,
        paymentId: validated.value.paymentId,
        receiptId: createdReceipt?.id ?? null,
      });
    } catch (error: unknown) {
      setReceiptFormError(toFinanceClientErrorCode(error, "SUBMIT_RECEIPT_FAILED"));
    } finally {
      setReceiptSaving(false);
    }
  };

  if (!canManage || normalizedRegistrationId.length < 32) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {showActionBanner && actionBanner?.kind === "manual_payment_created" ? (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
          data-testid={FINANCE_PAYMENTS_TEST_IDS.createResult}
          data-payment-status={actionBanner.payment.status}
        >
          <span className="font-medium">{t("createResultTitle")}</span>
          {" — "}
          {formatMinorAmount(actionBanner.payment.amount, actionBanner.payment.currency, locale)}
          {" · "}
          {t("createResultNext")}
          {actionBanner.payment.registrationId.length >= 32 ? (
            <>
              {" "}
              <Link
                href={buildFinancePaymentReceiptsHref(actionBanner.payment.registrationId)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t("createResultOpenReceipts")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {showActionBanner && actionBanner?.kind === "receipt_submitted" ? (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
          data-testid="finance-registration-receipt-submit-result"
          data-payment-id={actionBanner.paymentId}
          data-receipt-id={actionBanner.receiptId ?? ""}
        >
          <span className="font-medium">{t("receiptSubmittedTitle")}</span>
          {" — "}
          {t("receiptSubmittedNext")}{" "}
          <Link
            href={buildFinancePaymentReceiptsHref(actionBanner.registrationId)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("createResultOpenReceipts")}
          </Link>
        </p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("createManual")}</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">{t("createManualHint")}</p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.createForm}
            onSubmit={handleCreateManualPayment}
          >
            <div className="space-y-2">
              <FinanceInvoiceBalanceCard registrationId={normalizedRegistrationId} />
              {!invoiceLoaded ? (
                <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`workspace-payment-amount-${normalizedRegistrationId}`}>
                  {tCommon("amountDisplay")}
                </Label>
                <LocalizedNumericInput
                  id={`workspace-payment-amount-${normalizedRegistrationId}`}
                  mode="digits"
                  groupThousands
                  value={amount}
                  onChange={setAmount}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`workspace-payment-currency-${normalizedRegistrationId}`}>
                  {tCommon("currency")}
                </Label>
                <Input
                  id={`workspace-payment-currency-${normalizedRegistrationId}`}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  maxLength={8}
                />
              </div>
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {localizeFinanceMessage(tValidation, tErrors, formError)}
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("createDoesNotSettle")}</p>
              <Button type="submit" disabled={saving}>
                {saving ? t("creating") : t("createButton")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card data-operator-surface="card" className="border-dashed shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t("submitReceiptAdvanced")}</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">{t("submitReceiptHint")}</p>
        </CardHeader>
        <CardContent>
          <details
            open={advancedOpen}
            data-testid="finance-submit-receipt-advanced"
            onToggle={(event) => {
              setAdvancedOpen((event.target as HTMLDetailsElement).open);
            }}
          >
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              {t("submitReceiptShowAdvanced")}
            </summary>
            <form
              className="mt-4 grid gap-4"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptForm}
              onSubmit={handleSubmitReceipt}
            >
              <div className="space-y-2">
                <Label htmlFor={`workspace-receipt-payment-id-${normalizedRegistrationId}`}>
                  {t("paymentId")}
                </Label>
                <Input
                  id={`workspace-receipt-payment-id-${normalizedRegistrationId}`}
                  value={receiptForm.paymentId}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, paymentId: event.target.value }))
                  }
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{t("paymentIdPrefillHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`workspace-receipt-upload-${normalizedRegistrationId}`}>
                  {t("receiptUpload")}
                </Label>
                <Input
                  id={`workspace-receipt-upload-${normalizedRegistrationId}`}
                  type="file"
                  accept="image/*,application/pdf"
                  data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptUploadInput}
                  disabled={receiptUploadBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file === undefined) {
                      return;
                    }
                    setReceiptUploadError(null);
                    setReceiptUploadBusy(true);
                    void uploadFinanceReceiptProof({
                      registrationId: normalizedRegistrationId,
                      file,
                    })
                      .then((fileKey) => {
                        if (fileKey === null) {
                          throw new Error("RECEIPT_UPLOAD_FAILED");
                        }
                        setReceiptForm((current) => ({ ...current, fileKey }));
                      })
                      .catch((error: unknown) => {
                        setReceiptUploadError(
                          error instanceof Error ? error.message : "RECEIPT_UPLOAD_FAILED"
                        );
                      })
                      .finally(() => {
                        setReceiptUploadBusy(false);
                      });
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("receiptUploadHint")}</p>
                {receiptUploadError !== null ? (
                  <p className="text-xs text-destructive" role="alert">
                    {localizeFinanceMessage(tValidation, tErrors, receiptUploadError)}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`workspace-receipt-file-key-${normalizedRegistrationId}`}>
                  {t("fileKey")}
                </Label>
                <Input
                  id={`workspace-receipt-file-key-${normalizedRegistrationId}`}
                  value={receiptForm.fileKey}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, fileKey: event.target.value }))
                  }
                  placeholder={t("fileKeyPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`workspace-receipt-note-${normalizedRegistrationId}`}>
                  {tCommon("optionalNote")}
                </Label>
                <Input
                  id={`workspace-receipt-note-${normalizedRegistrationId}`}
                  value={receiptForm.note}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, note: event.target.value }))
                  }
                />
              </div>
              {receiptFormError ? (
                <p className="text-sm text-destructive" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, receiptFormError)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={receiptSaving} variant="secondary">
                  {receiptSaving ? t("submitting") : t("submitButton")}
                </Button>
                {receiptForm.paymentId.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReceiptForm(EMPTY_RECEIPT_FORM)}
                  >
                    {t("clearSelectedPayment")}
                  </Button>
                ) : null}
              </div>
            </form>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
