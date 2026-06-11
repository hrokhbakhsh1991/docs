"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  FINANCE_INVOICE_TEST_IDS,
  buildInvoiceLookupPath,
  parseRegistrationInvoice,
  validateInvoiceLookupRegistrationId,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import {
  FINANCE_PREPAYMENTS_TEST_IDS,
  buildRecordPrepaymentRequestBody,
  formatMinorAmount,
  formatPrepaymentRecordedAt,
  parsePrepaymentsListResponse,
  validateRecordPrepaymentForm,
  type PrepaymentRecord,
  type RecordPrepaymentFormState,
} from "@/finance/finance-prepayments-logic";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import type { AppLocale } from "@/i18n/routing";

type FinancePrepaymentsPanelProps = {
  readonly session: OperatorSessionContext;
};

const EMPTY_FORM: RecordPrepaymentFormState = {
  registrationId: "",
  amountMinor: "",
  currency: "IRR",
  method: "Manual",
  note: "",
};

export function FinancePrepaymentsPanel({ session }: FinancePrepaymentsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.prepayments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const [items, setItems] = useState<readonly PrepaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RecordPrepaymentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [invoiceLookupId, setInvoiceLookupId] = useState("");
  const [invoiceLookupError, setInvoiceLookupError] = useState<string | null>(null);
  const [invoiceLookupBusy, setInvoiceLookupBusy] = useState(false);
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch("/api/finance/prepayments?limit=50", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PREPAYMENTS_LIST_HTTP_${response.status}`);
        }
        return parsePrepaymentsListResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "PREPAYMENTS_FETCH_FAILED");
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

  const handleInvoiceLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInvoiceLookupError(null);
    setInvoice(null);
    const validated = validateInvoiceLookupRegistrationId(invoiceLookupId);
    if (!validated.ok) {
      setInvoiceLookupError(validated.error);
      return;
    }
    setInvoiceLookupBusy(true);
    try {
      const response = await fetch(buildInvoiceLookupPath(validated.value), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`INVOICE_LOOKUP_HTTP_${response.status}`);
      }
      const parsed = parseRegistrationInvoice(await response.json());
      if (parsed === null) {
        throw new Error("INVOICE_LOOKUP_PARSE_FAILED");
      }
      setInvoice(parsed);
    } catch (lookupError: unknown) {
      setInvoiceLookupError(
        lookupError instanceof Error ? lookupError.message : "INVOICE_LOOKUP_FAILED"
      );
    } finally {
      setInvoiceLookupBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    const validated = validateRecordPrepaymentForm(form);
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/finance/prepayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRecordPrepaymentRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`PREPAYMENT_RECORD_HTTP_${response.status}`);
      }
      setForm(EMPTY_FORM);
      refresh();
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error ? submitError.message : "PREPAYMENT_RECORD_FAILED"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_PREPAYMENTS_TEST_IDS.panel}>
      <Card data-denali-surface="card" className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("invoiceBalance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            data-testid={FINANCE_INVOICE_TEST_IDS.lookupForm}
            onSubmit={handleInvoiceLookup}
          >
            <div className="grow space-y-2">
              <Label htmlFor="invoice-registration-id">{tCommon("registrationId")}</Label>
              <Input
                id="invoice-registration-id"
                value={invoiceLookupId}
                onChange={(event) => setInvoiceLookupId(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={invoiceLookupBusy}>
              {invoiceLookupBusy ? tCommon("loading") : t("lookupBalance")}
            </Button>
          </form>
          {invoiceLookupError ? (
            <p className="text-sm text-destructive" role="alert">
              {localizeFinanceMessage(tValidation, tErrors, invoiceLookupError)}
            </p>
          ) : null}
          {invoice ? (
            <div
              className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-3"
              data-testid={FINANCE_INVOICE_TEST_IDS.balancePanel}
            >
              <div>
                <p className="text-xs text-muted-foreground">{t("invoiceTotal")}</p>
                <p className="font-medium">
                  {formatMinorAmount(invoice.invoiceTotalMinor, invoice.currency, locale)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("paid")}</p>
                <p className="font-medium">
                  {formatMinorAmount(invoice.paidAmountMinor, invoice.currency, locale)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("balanceDue")}</p>
                <p className="font-medium">
                  {formatMinorAmount(invoice.balanceDueMinor, invoice.currency, locale)}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <Card data-denali-surface="card" className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("recordTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              data-testid={FINANCE_PREPAYMENTS_TEST_IDS.recordForm}
              onSubmit={handleSubmit}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prepay-registration-id">{tCommon("registrationId")}</Label>
                <Input
                  id="prepay-registration-id"
                  value={form.registrationId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, registrationId: event.target.value }))
                  }
                  placeholder="00000000-0000-4000-8000-000000000001"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay-amount">{tCommon("amountMinor")}</Label>
                <LocalizedNumericInput
                  id="prepay-amount"
                  mode="digits"
                  value={form.amountMinor}
                  onChange={(amountMinor) =>
                    setForm((current) => ({ ...current, amountMinor }))
                  }
                  placeholder="5000000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay-currency">{tCommon("currency")}</Label>
                <Input
                  id="prepay-currency"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value }))
                  }
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay-method">{t("method")}</Label>
                <Input
                  id="prepay-method"
                  value={form.method}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, method: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prepay-note">{tCommon("optionalNote")}</Label>
                <textarea
                  id="prepay-note"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.note}
                  maxLength={2000}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, note: event.target.value }))
                  }
                />
              </div>
              {formError ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, formError)}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t("recording") : t("recordButton")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card data-denali-surface="card" className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("recentTitle")}</CardTitle>
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
            <p
              className="text-sm text-muted-foreground"
              data-testid={FINANCE_PREPAYMENTS_TEST_IDS.emptyState}
            >
              {t("empty")}
            </p>
          ) : null}
          {!loading && !error && items.length > 0 ? (
            <ul
              className="divide-y rounded-md border"
              data-testid={FINANCE_PREPAYMENTS_TEST_IDS.list}
            >
              {items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatMinorAmount(item.amountMinor, item.currency, locale)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.registrationId}
                    </p>
                    {item.note ? (
                      <p className="text-sm text-muted-foreground">{item.note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">{item.method}</Badge>
                    <span>{formatPrepaymentRecordedAt(item.recordedAt, locale)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
