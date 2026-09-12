"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { useEffect, useRef, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import { FinanceRegistrationIdentity } from "@/finance/finance-registration-identity";
import { FinanceRegistrationPicker } from "@/finance/finance-registration-picker";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import { fetchFinanceListWithRetry } from "@/finance/fetch-finance-list-with-retry";
import {
  FINANCE_INVOICE_TEST_IDS,
  fetchRegistrationInvoice,
  resolveSuggestedPaymentAmountMinor,
} from "@/finance/finance-invoice-logic";
import {
  FINANCE_PREPAYMENTS_TEST_IDS,
  buildRecordPrepaymentRequestBody,
  formatMinorAmount,
  formatPrepaymentRecordedAt,
  parsePrepaymentsListResponse,
  validateRecordPrepaymentForm,
  type PrepaymentRecord,
  type PrepaymentsListResponse,
  type RecordPrepaymentFormState,
} from "@/finance/finance-prepayments-logic";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";
import type { AppLocale } from "@/i18n/routing";

type FinancePrepaymentsPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialPrepayments?: PrepaymentsListResponse | null;
};

const EMPTY_FORM: RecordPrepaymentFormState = {
  registrationId: "",
  amountMinor: "",
  currency: "",
  method: "Manual",
  note: "",
};

export function FinancePrepaymentsPanel({
  session,
  initialPrepayments = null,
}: FinancePrepaymentsPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.prepayments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const canManage = isAdminOrOwnerRole(session.role);
  const searchParams = useAppSearchParams();
  const registrationFilter = searchParams.get("registrationId");
  const tourFilter = searchParams.get("tourId");
  const [items, setItems] = useState<readonly PrepaymentRecord[]>(initialPrepayments?.items ?? []);
  const [loading, setLoading] = useState(initialPrepayments === null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RecordPrepaymentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialPrepayments !== null);
  const amountPrefilledForRegistrationRef = useRef<string | null>(null);
  const [invoiceLookupId, setInvoiceLookupId] = useState("");

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const path = withFinanceListScopeQuery("/api/finance/prepayments?limit=50", {
      registrationId: registrationFilter,
      tourId: tourFilter,
    });
    void fetchFinanceListWithRetry(path, controller.signal)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`PREPAYMENTS_LIST_HTTP_${response.status}`);
        }
        return parsePrepaymentsListResponse(await response.json());
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setItems(payload.items);
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
        setError(toFinanceClientErrorCode(fetchError, "PREPAYMENTS_FETCH_FAILED"));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, [fetchNonce, registrationFilter, tourFilter]);

  useEffect(() => {
    const registrationId = form.registrationId.trim();
    if (registrationId.length < 32) {
      amountPrefilledForRegistrationRef.current = null;
      return;
    }
    if (amountPrefilledForRegistrationRef.current === registrationId) {
      return;
    }
    let cancelled = false;
    void fetchRegistrationInvoice(registrationId)
      .then((invoice) => {
        if (cancelled || invoice === null) {
          return;
        }
        amountPrefilledForRegistrationRef.current = registrationId;
        setForm((current) => {
          if (
            current.registrationId.trim() !== registrationId ||
            current.amountMinor.trim().length > 0
          ) {
            return current;
          }
          return {
            ...current,
            amountMinor: resolveSuggestedPaymentAmountMinor(invoice),
            currency: invoice.currency,
          };
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.registrationId]);

  const refresh = () => setFetchNonce((value) => value + 1);

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
        throw new Error(`RECORD_PREPAYMENT_HTTP_${response.status}`);
      }
      setForm(EMPTY_FORM);
      refresh();
    } catch (submitError: unknown) {
      setFormError(toFinanceClientErrorCode(submitError, "RECORD_PREPAYMENT_FAILED"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={FINANCE_PREPAYMENTS_TEST_IDS.panel}>
      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("invoiceBalance")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid={FINANCE_INVOICE_TEST_IDS.lookupForm}>
          <FinanceRegistrationPicker
            id="invoice-registration-id"
            value={invoiceLookupId}
            onChange={(registrationId) => {
              setInvoiceLookupId(registrationId);
              setForm((current) =>
                current.registrationId.length === 0 ? { ...current, registrationId } : current
              );
            }}
          />
          <FinanceInvoiceBalanceCard registrationId={invoiceLookupId} />
        </CardContent>
      </Card>

      {canManage ? (
        <Card data-operator-surface="card" className="shadow-sm">
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
                <FinanceRegistrationPicker
                  id="prepay-registration-id"
                  value={form.registrationId}
                  onChange={(registrationId) =>
                    setForm((current) => ({ ...current, registrationId }))
                  }
                />
                <FinanceInvoiceBalanceCard registrationId={form.registrationId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepay-amount">{tCommon("amountDisplay")}</Label>
                <LocalizedNumericInput
                  id="prepay-amount"
                  mode="digits"
                  groupThousands
                  value={form.amountMinor}
                  onChange={(amountMinor) => setForm((current) => ({ ...current, amountMinor }))}
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

      <Card data-operator-surface="card" className="shadow-sm">
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
                <li
                  key={item.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatMinorAmount(item.amountMinor, item.currency, locale)}
                    </p>
                    <FinanceRegistrationIdentity
                      registrationId={item.registrationId}
                      context={item.registrationContext}
                    />
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
