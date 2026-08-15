"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { resolveDenaliSuggestedPrepaymentMinor } from "@app-tour/workspace-denali/host/bookings";

import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinanceInvoiceBalanceCard } from "@/finance/finance-invoice-balance-card";
import {
  fetchRegistrationInvoice,
  resolveSuggestedPaymentAmountMinor,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import {
  createFinanceIdempotencyKey,
  FINANCE_PAYMENTS_TEST_IDS,
} from "@/finance/finance-payments-logic";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import {
  buildRecordPrepaymentRequestBody,
  formatMinorAmount,
  validateRecordPrepaymentForm,
} from "@/finance/finance-prepayments-logic";
import { fetchTourDetailCached, readCachedTourDetail } from "@/features/tours/tour-route-cache";
import type { TourWorkspacePaymentActionEvent } from "@/features/tours/tour-workspace-finance-logic";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";
import { cn } from "@/lib/utils";

type TourWorkspaceAdminPaymentCardProps = {
  readonly tourId: string;
  readonly registrationId: string;
  readonly canManage: boolean;
  readonly onChanged?: (event: TourWorkspacePaymentActionEvent) => void;
  readonly className?: string;
  readonly refreshKey?: string | number;
};

type PaymentActionBanner = {
  readonly kind: "prepayment_recorded";
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly remainingMinor: string;
};

function parseMinor(value: string): bigint {
  const digits = value.trim();
  if (!/^\d+$/.test(digits)) {
    return BigInt(0);
  }
  return BigInt(digits);
}

export function TourWorkspaceAdminPaymentCard({
  tourId,
  registrationId,
  canManage,
  onChanged,
  className,
  refreshKey,
}: TourWorkspaceAdminPaymentCardProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.finance");
  const tPayments = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const normalizedRegistrationId = registrationId.trim();
  const normalizedTourId = tourId.trim();
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("IRR");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBanner, setActionBanner] = useState<PaymentActionBanner | null>(null);
  const [invoiceLoaded, setInvoiceLoaded] = useState(false);
  const [tourCanonicalData, setTourCanonicalData] = useState<Record<string, unknown> | null>(() =>
    readCachedTourDetail(normalizedTourId)?.canonical.data ?? null
  );
  const amountPrefilledRef = useRef<string | null>(null);

  useEffect(() => {
    setAmount("");
    setCurrency("IRR");
    setFormError(null);
    setActionBanner(null);
    amountPrefilledRef.current = null;
  }, [normalizedRegistrationId, refreshKey]);

  useEffect(() => {
    if (normalizedTourId.length === 0) {
      setTourCanonicalData(null);
      return;
    }
    const cached = readCachedTourDetail(normalizedTourId);
    if (cached !== null) {
      setTourCanonicalData(cached.canonical.data);
    }

    let cancelled = false;
    void fetchTourDetailCached(normalizedTourId)
      .then((detail) => {
        if (!cancelled) {
          setTourCanonicalData(detail.canonical.data);
        }
      })
      .catch(() => {
        if (!cancelled && cached === null) {
          setTourCanonicalData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [normalizedTourId, refreshKey]);

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
    const suggested =
      tourCanonicalData !== null
        ? resolveDenaliSuggestedPrepaymentMinor({
            tourCanonicalData,
            invoiceTotalMinor: invoice.invoiceTotalMinor,
            balanceDueMinor: invoice.balanceDueMinor,
          })
        : null;
    setAmount(suggested ?? resolveSuggestedPaymentAmountMinor(invoice));
    setCurrency(invoice.currency);
  }, [amount, invoice, normalizedRegistrationId, tourCanonicalData]);

  const handleRecordAdminPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setFormError(null);
    setActionBanner(null);
    const validated = validateRecordPrepaymentForm({
      registrationId: normalizedRegistrationId,
      amountMinor: amount,
      currency,
      method: "Manual",
      note: "",
    });
    if (!validated.ok) {
      setFormError(validated.error);
      return;
    }
    setSaving(true);
    try {
      const remainingBeforeMinor = invoice?.balanceDueMinor ?? "0";
      const remainingAfterMinor = (() => {
        const after = parseMinor(remainingBeforeMinor) - parseMinor(validated.value.amountMinor);
        return (after > BigInt(0) ? after : BigInt(0)).toString();
      })();
      const response = await fetch("/api/finance/prepayments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createFinanceIdempotencyKey("workspace-prepayment"),
        },
        body: JSON.stringify(buildRecordPrepaymentRequestBody(validated.value)),
      });
      if (!response.ok) {
        throw new Error(`RECORD_PREPAYMENT_HTTP_${response.status}`);
      }
      invalidateFinanceRegistrationCaches(normalizedRegistrationId);
      setActionBanner({
        kind: "prepayment_recorded",
        registrationId: normalizedRegistrationId,
        amountMinor: validated.value.amountMinor,
        currency: validated.value.currency,
        remainingMinor: remainingAfterMinor,
      });
      setAmount("");
      amountPrefilledRef.current = null;
      onChanged?.({
        kind: "prepayment_recorded",
        registrationId: normalizedRegistrationId,
        amountMinor: validated.value.amountMinor,
        currency: validated.value.currency,
      });
    } catch (error: unknown) {
      setFormError(toFinanceClientErrorCode(error, "RECORD_PREPAYMENT_FAILED"));
    } finally {
      setSaving(false);
    }
  };

  if (!canManage || normalizedRegistrationId.length < 32) {
    return null;
  }

  const defaultAmountLabel =
    invoice !== null
      ? formatMinorAmount(
          tourCanonicalData !== null
            ? resolveDenaliSuggestedPrepaymentMinor({
                tourCanonicalData,
                invoiceTotalMinor: invoice.invoiceTotalMinor,
                balanceDueMinor: invoice.balanceDueMinor,
              }) ?? resolveSuggestedPaymentAmountMinor(invoice)
            : resolveSuggestedPaymentAmountMinor(invoice),
          invoice.currency,
          locale
        )
      : null;

  return (
    <div className={cn("space-y-4", className)}>
      {actionBanner?.kind === "prepayment_recorded" ? (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
          data-testid={FINANCE_PAYMENTS_TEST_IDS.createResult}
          data-payment-status="Paid"
        >
          <span className="font-medium">{t("workspacePaymentRecordedTitle")}</span>
          {" — "}
          {formatMinorAmount(actionBanner.amountMinor, actionBanner.currency, locale)}
          {" · "}
          {t("workspacePaymentRecordedHint")}
          {" "}
          {parseMinor(actionBanner.remainingMinor) > BigInt(0)
            ? t("workspacePaymentRecordedRemaining", {
                amount: formatMinorAmount(
                  actionBanner.remainingMinor,
                  actionBanner.currency,
                  locale
                ),
              })
            : t("workspacePaymentRecordedSettled")}
        </p>
      ) : null}
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("workspacePaymentDescription")}</p>
        <div data-operator-surface="card" className="rounded-md border bg-background px-4 py-4">
          <form
            className="grid gap-4"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.createForm}
            onSubmit={handleRecordAdminPayment}
          >
            <div className="space-y-2">
              <FinanceInvoiceBalanceCard
                registrationId={normalizedRegistrationId}
                refreshKey={refreshKey}
              />
              {!invoiceLoaded ? (
                <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
              ) : null}
              {defaultAmountLabel !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t("workspacePaymentSuggested", { amount: defaultAmountLabel })}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  disabled={invoice !== null}
                />
              </div>
            </div>
            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {localizeFinanceMessage(tValidation, tErrors, formError)}
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t("workspacePaymentHint")}</p>
              <Button type="submit" disabled={saving}>
                {saving ? tPayments("creating") : t("workspacePaymentButton")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
