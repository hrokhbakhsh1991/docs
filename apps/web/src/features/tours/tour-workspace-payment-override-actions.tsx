"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { withFinanceRegistrationQuery } from "@/finance/finance-registration-context";
import { invalidateTourWorkspaceFinanceCache } from "@/features/tours/tour-workspace-finance-fetch-cache";
import type { RegistrationInvoice } from "@/finance/finance-invoice-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import type { AppLocale } from "@/i18n/routing";
import {
  localizeFinanceMessage,
  toFinanceClientErrorCode,
} from "@/i18n/resolve-finance-error-message";

type TourWorkspacePaymentOverrideActionsProps = {
  readonly tourId?: string;
  readonly registrationId: string;
  readonly canManage: boolean;
  readonly invoice: RegistrationInvoice | null;
  readonly hasActiveSchedule: boolean;
  readonly onChanged?: (event: {
    readonly registrationId: string;
    readonly obligationMinor: string;
  }) => void;
};

function isMinorAmount(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function TourWorkspacePaymentOverrideActions({
  tourId,
  registrationId,
  canManage,
  invoice,
  hasActiveSchedule,
  onChanged,
}: TourWorkspacePaymentOverrideActionsProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.finance");
  const tCommon = useTranslations("common");
  const tFinanceCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const normalizedRegistrationId = registrationId.trim();
  const [amountMinor, setAmountMinor] = useState("");
  const [reason, setReason] = useState("");
  const [savingMode, setSavingMode] = useState<"amount" | "zero" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAmountMinor, setSavedAmountMinor] = useState<string | null>(null);

  if (!canManage || normalizedRegistrationId.length < 32) {
    return null;
  }

  const currency = invoice?.currency ?? "";
  const hasInvoice = invoice !== null;
  const savedAmountLabel =
    savedAmountMinor !== null ? formatMinorAmount(savedAmountMinor, currency, locale) : null;

  const submitOverride = async (nextAmountMinor: string, mode: "amount" | "zero") => {
    if (!hasInvoice) {
      setError("INVOICE_FETCH_FAILED");
      return;
    }
    if (!isMinorAmount(nextAmountMinor)) {
      setError("ZOD_VALIDATION_FAILED");
      return;
    }

    setError(null);
    setSavingMode(mode);
    try {
      const response = await fetch(
        `/api/finance/registrations/${encodeURIComponent(normalizedRegistrationId)}/obligation-override`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            obligationMinor: nextAmountMinor.trim(),
            ...(reason.trim().length > 0 ? { reason: reason.trim() } : {}),
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`SET_OBLIGATION_OVERRIDE_HTTP_${response.status}`);
      }
      setSavedAmountMinor(nextAmountMinor.trim());
      if (mode === "amount") {
        setAmountMinor("");
      }
      invalidateFinanceRegistrationCaches(normalizedRegistrationId);
      const scopedTourId = tourId?.trim() ?? "";
      if (scopedTourId.length > 0) {
        invalidateTourWorkspaceFinanceCache(scopedTourId);
      }
      onChanged?.({
        registrationId: normalizedRegistrationId,
        obligationMinor: nextAmountMinor.trim(),
      });
    } catch (submitError: unknown) {
      setError(toFinanceClientErrorCode(submitError, "SET_OBLIGATION_OVERRIDE_FAILED"));
    } finally {
      setSavingMode(null);
    }
  };

  if (hasActiveSchedule) {
    return (
      <div className="rounded-md border border-dashed px-3 py-3 text-sm">
        <p className="font-medium">{t("detailOverrideScheduleTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("detailOverrideScheduleDescription")}</p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <OperatorInternalLink
            href={withFinanceRegistrationQuery(
              "/finance?tab=installments",
              normalizedRegistrationId
            )}
          >
            {t("detailOverrideOpenInstallments")}
          </OperatorInternalLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("detailOverrideTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("detailOverrideDescription")}</p>
        {invoice !== null ? (
          <p className="text-xs text-muted-foreground">
            {t("detailOverrideCurrentInvoice", {
              amount: formatMinorAmount(invoice.balanceDueMinor, invoice.currency, locale),
            })}
          </p>
        ) : null}
        {savedAmountLabel !== null ? (
          <p className="text-xs text-muted-foreground">
            {t("detailOverrideSaved", { amount: savedAmountLabel })}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`workspace-obligation-amount-${normalizedRegistrationId}`}>
            {t("detailOverrideAmountLabel")}
          </Label>
          <LocalizedNumericInput
            id={`workspace-obligation-amount-${normalizedRegistrationId}`}
            mode="digits"
            groupThousands
            value={amountMinor}
            onChange={setAmountMinor}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`workspace-obligation-reason-${normalizedRegistrationId}`}>
            {tFinanceCommon("optionalNote")}
          </Label>
          <Input
            id={`workspace-obligation-reason-${normalizedRegistrationId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("detailOverrideReasonPlaceholder")}
            maxLength={2000}
          />
        </div>
      </div>

      {error !== null ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {localizeFinanceMessage(tValidation, tErrors, error)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={savingMode !== null || !isMinorAmount(amountMinor)}
          onClick={() => void submitOverride(amountMinor, "amount")}
        >
          {savingMode === "amount" ? tCommon("saving") : t("detailOverrideSave")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={savingMode !== null}
          onClick={() => void submitOverride("0", "zero")}
        >
          {savingMode === "zero" ? tCommon("saving") : t("detailOverrideNoPayment")}
        </Button>
      </div>
    </div>
  );
}
