"use client";

import type { VariantProps } from "class-variance-authority";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  FINANCE_PAYMENTS_TEST_IDS,
  buildCreateManualPaymentRequestBody,
  buildSubmitReceiptRequestBody,
  parseFinancePaymentsListResponse,
  paymentStatusTone,
  validateCreateManualPaymentForm,
  validateSubmitReceiptForm,
  type CreateManualPaymentFormState,
  type FinancePaymentRow,
  type SubmitReceiptFormState,
} from "@/finance/finance-payments-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { formatFinanceTimestamp } from "@/finance/finance-reports-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";

type FinancePaymentsPanelProps = {
  readonly session: OperatorSessionContext;
};

const EMPTY_FORM: CreateManualPaymentFormState = {
  registrationId: "",
  amount: "",
  currency: "IRR",
};

const EMPTY_RECEIPT_FORM: SubmitReceiptFormState = {
  paymentId: "",
  fileKey: "",
  note: "",
};

function resolveFinancePaymentStatusLabel(t: (key: string) => string, status: string): string {
  try {
    return t(`status.${status}`);
  } catch {
    return status;
  }
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function statusVariant(tone: ReturnType<typeof paymentStatusTone>): BadgeVariant {
  if (tone === "success") {
    return "success";
  }
  if (tone === "destructive") {
    return "destructive";
  }
  if (tone === "warning") {
    return "warning";
  }
  return "default";
}

function PaymentRow({
  row,
  locale,
  statusLabel,
}: {
  readonly row: FinancePaymentRow;
  readonly locale: AppLocale;
  readonly statusLabel: string;
}) {
  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium">{formatMinorAmount(row.amount, row.currency, locale)}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.registrationId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={statusVariant(paymentStatusTone(row.status))}>{statusLabel}</Badge>
        <Badge variant="outline">{row.method}</Badge>
        <span>{formatFinanceTimestamp(row.createdAt, locale)}</span>
      </div>
    </li>
  );
}

export function FinancePaymentsPanel({ session }: FinancePaymentsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly FinancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateManualPaymentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState<SubmitReceiptFormState>(EMPTY_RECEIPT_FORM);
  const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/payments?limit=50", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PAYMENTS_LIST_HTTP_${response.status}`);
        }
        return parseFinancePaymentsListResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "PAYMENTS_FETCH_FAILED");
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

  const refresh = () => setFetchNonce((value) => value + 1);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    const validated = validateCreateManualPaymentForm(form);
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/finance/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateManualPaymentRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`MANUAL_PAYMENT_HTTP_${response.status}`);
      }
      setForm(EMPTY_FORM);
      refresh();
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error ? submitError.message : "MANUAL_PAYMENT_FAILED"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setReceiptFormError(null);
    const validated = validateSubmitReceiptForm(receiptForm);
    if (!validated.ok) {
      setReceiptFormError(validated.error);
      return;
    }
    setReceiptSaving(true);
    try {
      const response = await fetch("/api/finance/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmitReceiptRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`RECEIPT_SUBMIT_HTTP_${response.status}`);
      }
      setReceiptForm(EMPTY_RECEIPT_FORM);
      refresh();
    } catch (submitError: unknown) {
      setReceiptFormError(
        submitError instanceof Error ? submitError.message : "RECEIPT_SUBMIT_FAILED"
      );
    } finally {
      setReceiptSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_PAYMENTS_TEST_IDS.panel}>
      {canManage ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("createManual")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.createForm}
              onSubmit={handleSubmit}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="payment-registration-id">{tCommon("registrationId")}</Label>
                <Input
                  id="payment-registration-id"
                  value={form.registrationId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, registrationId: event.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-amount">{tCommon("amountMinor")}</Label>
                <LocalizedNumericInput
                  id="payment-amount"
                  mode="digits"
                  groupThousands
                  value={form.amount}
                  onChange={(amount) => setForm((current) => ({ ...current, amount }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-currency">{tCommon("currency")}</Label>
                <Input
                  id="payment-currency"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value }))
                  }
                  maxLength={8}
                />
              </div>
              {formError ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, formError)}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t("creating") : t("createButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("submitReceipt")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptForm}
              onSubmit={handleReceiptSubmit}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receipt-payment-id">{t("paymentId")}</Label>
                <Input
                  id="receipt-payment-id"
                  value={receiptForm.paymentId}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, paymentId: event.target.value }))
                  }
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receipt-file-key">{t("fileKey")}</Label>
                <Input
                  id="receipt-file-key"
                  value={receiptForm.fileKey}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, fileKey: event.target.value }))
                  }
                  placeholder={t("fileKeyPlaceholder")}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receipt-note">{tCommon("optionalNote")}</Label>
                <Input
                  id="receipt-note"
                  value={receiptForm.note}
                  onChange={(event) =>
                    setReceiptForm((current) => ({ ...current, note: event.target.value }))
                  }
                />
              </div>
              {receiptFormError ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, receiptFormError)}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={receiptSaving}>
                  {receiptSaving ? t("submitting") : t("submitButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card data-denali-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {tCommon("refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : null}
          {!loading && error ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, error)}
            </p>
          ) : null}
          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <ul className="divide-y rounded-md border" data-testid={FINANCE_PAYMENTS_TEST_IDS.list}>
              {items.map((row) => (
                <PaymentRow
                  key={row.id}
                  row={row}
                  locale={locale}
                  statusLabel={resolveFinancePaymentStatusLabel(t, row.status)}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
