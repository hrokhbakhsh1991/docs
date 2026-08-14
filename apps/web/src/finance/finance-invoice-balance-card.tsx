"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  FINANCE_INVOICE_TEST_IDS,
  buildInvoiceLookupPath,
  parseRegistrationInvoice,
  type RegistrationInvoice,
} from "@/finance/finance-invoice-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  FINANCE_REGISTRATION_CACHE_NS,
  readFinanceRegistrationCache,
  writeFinanceRegistrationCache,
} from "@/finance/finance-registration-fetch-cache";
import type { AppLocale } from "@/i18n/routing";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

type InvoiceCachePayload = {
  readonly invoice: RegistrationInvoice | null;
};

type FinanceInvoiceBalanceCardProps = {
  readonly registrationId: string;
  /** When true, fetch whenever registrationId is a non-empty UUID-like string. */
  readonly autoLoad?: boolean;
  /** Optional caller-controlled refresh signal for same-registration mutations. */
  readonly refreshKey?: string | number;
};

/**
 * Phase C — invoice read model only (R-ARCH-08). No local paid/due math.
 */
export function FinanceInvoiceBalanceCard({
  registrationId,
  autoLoad = true,
  refreshKey,
}: FinanceInvoiceBalanceCardProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.prepayments");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const [invoice, setInvoice] = useState<RegistrationInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () => autoLoad && registrationId.trim().length >= 32
  );

  useEffect(() => {
    if (!autoLoad) {
      return;
    }
    const id = registrationId.trim();
    if (id.length < 32) {
      setInvoice(null);
      setError(null);
      return;
    }
    const hit = readFinanceRegistrationCache<InvoiceCachePayload>(
      FINANCE_REGISTRATION_CACHE_NS.invoiceBalance,
      id
    );
    if (hit !== null) {
      setInvoice(hit.invoice);
      setError(hit.invoice === null ? "INVOICE_PARSE_FAILED" : null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(buildInvoiceLookupPath(id), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`INVOICE_HTTP_${response.status}`);
        }
        return parseRegistrationInvoice(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          writeFinanceRegistrationCache(FINANCE_REGISTRATION_CACHE_NS.invoiceBalance, id, {
            invoice: payload,
          });
          setInvoice(payload);
          if (payload === null) {
            setError("INVOICE_PARSE_FAILED");
          }
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setInvoice(null);
          setError(toFinanceClientErrorCode(fetchError, "INVOICE_FETCH_FAILED"));
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
  }, [autoLoad, refreshKey, registrationId]);

  if (registrationId.trim().length < 32 && !loading) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid={FINANCE_INVOICE_TEST_IDS.balancePanel}>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("invoiceLoading")}</p>
      ) : null}
      {error !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}
      {invoice !== null ? (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-3">
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
    </div>
  );
}
