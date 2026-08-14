"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSubmitReceiptRequestBody,
  createFinanceIdempotencyKey,
  FINANCE_PAYMENTS_TEST_IDS,
  parseFinanceReceiptCreateResponse,
  uploadFinanceReceiptProof,
  validateSubmitReceiptForm,
  type SubmitReceiptFormState,
} from "@/finance/finance-payments-logic";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import type { TourWorkspacePaymentActionEvent } from "@/features/tours/tour-workspace-finance-logic";
import { localizeFinanceMessage, toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

const EMPTY_RECEIPT_FORM: SubmitReceiptFormState = {
  paymentId: "",
  fileKey: "",
  note: "",
};

type TourWorkspaceAdvancedReceiptCardProps = {
  readonly registrationId: string;
  readonly canManage: boolean;
  readonly onChanged?: (event: TourWorkspacePaymentActionEvent) => void;
};

export function TourWorkspaceAdvancedReceiptCard({
  registrationId,
  canManage,
  onChanged,
}: TourWorkspaceAdvancedReceiptCardProps) {
  const t = useTranslations("tours.workspace.finance");
  const tPayments = useTranslations("finance.payments");
  const tCommon = useTranslations("finance.common");
  const tValidation = useTranslations("finance.validation");
  const tErrors = useTranslations("finance.errors");
  const normalizedRegistrationId = registrationId.trim();

  const [receiptForm, setReceiptForm] = useState<SubmitReceiptFormState>(EMPTY_RECEIPT_FORM);
  const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptUploadBusy, setReceiptUploadBusy] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submittedPaymentId, setSubmittedPaymentId] = useState<string | null>(null);
  const [submittedReceiptId, setSubmittedReceiptId] = useState<string | null>(null);

  if (!canManage || normalizedRegistrationId.length < 32) {
    return null;
  }

  const handleSubmitReceipt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReceiptFormError(null);
    setSubmittedPaymentId(null);
    setSubmittedReceiptId(null);
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
      setSubmittedPaymentId(validated.value.paymentId);
      setSubmittedReceiptId(createdReceipt?.id ?? null);
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

  return (
    <Card data-operator-surface="card" className="border-dashed shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("workspaceReceiptAdvancedTitle")}</CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          {t("workspaceReceiptAdvancedDescription")}
        </p>
      </CardHeader>
      <CardContent>
        {submittedPaymentId !== null ? (
          <p
            className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
            role="status"
            data-testid="finance-registration-receipt-submit-result"
            data-payment-id={submittedPaymentId}
            data-receipt-id={submittedReceiptId ?? ""}
          >
            <span className="font-medium">{tPayments("receiptSubmittedTitle")}</span>
            {" — "}
            {tPayments("receiptSubmittedNext")}
          </p>
        ) : null}
        <details
          open={advancedOpen}
          data-testid="finance-submit-receipt-advanced"
          onToggle={(event) => {
            setAdvancedOpen((event.target as HTMLDetailsElement).open);
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            {t("workspaceReceiptAdvancedOpen")}
          </summary>
          <form
            className="mt-4 grid gap-4"
            data-testid={FINANCE_PAYMENTS_TEST_IDS.receiptForm}
            onSubmit={handleSubmitReceipt}
          >
            <div className="space-y-2">
              <Label htmlFor={`workspace-receipt-payment-id-${normalizedRegistrationId}`}>
                {tPayments("paymentId")}
              </Label>
              <Input
                id={`workspace-receipt-payment-id-${normalizedRegistrationId}`}
                value={receiptForm.paymentId}
                onChange={(event) =>
                  setReceiptForm((current) => ({ ...current, paymentId: event.target.value }))
                }
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {t("workspaceReceiptAdvancedPaymentHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`workspace-receipt-upload-${normalizedRegistrationId}`}>
                {tPayments("receiptUpload")}
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
                  void uploadFinanceReceiptProof({ registrationId: normalizedRegistrationId, file })
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
              <p className="text-xs text-muted-foreground">
                {t("workspaceReceiptAdvancedUploadHint")}
              </p>
              {receiptUploadError !== null ? (
                <p className="text-xs text-destructive" role="alert">
                  {localizeFinanceMessage(tValidation, tErrors, receiptUploadError)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`workspace-receipt-file-key-${normalizedRegistrationId}`}>
                {tPayments("fileKey")}
              </Label>
              <Input
                id={`workspace-receipt-file-key-${normalizedRegistrationId}`}
                value={receiptForm.fileKey}
                onChange={(event) =>
                  setReceiptForm((current) => ({ ...current, fileKey: event.target.value }))
                }
                placeholder={tPayments("fileKeyPlaceholder")}
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
                {receiptSaving ? tPayments("submitting") : tPayments("submitButton")}
              </Button>
              {receiptForm.paymentId.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptForm(EMPTY_RECEIPT_FORM)}
                >
                  {tPayments("clearSelectedPayment")}
                </Button>
              ) : null}
            </div>
          </form>
        </details>
      </CardContent>
    </Card>
  );
}
