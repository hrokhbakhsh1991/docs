"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ReceiptProofPreview } from "@/finance/receipt-proof-preview";
import { type FinancePendingReceipt, receiptFileLabel } from "@/finance/finance-receipts-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { AppLocale } from "@/i18n/routing";

type TourWorkspacePaymentEvidenceListProps = {
  readonly receipts: readonly FinancePendingReceipt[];
  readonly locale: AppLocale;
  readonly formatDetailDate: (locale: AppLocale, value: string | null) => string | null;
};

function normalizeReceiptStatus(status: string): "pending" | "approved" | "rejected" | "unknown" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") {
    return "pending";
  }
  if (normalized === "approved") {
    return "approved";
  }
  if (normalized === "rejected") {
    return "rejected";
  }
  return "unknown";
}

export function TourWorkspacePaymentEvidenceList({
  receipts,
  locale,
  formatDetailDate,
}: TourWorkspacePaymentEvidenceListProps) {
  const t = useTranslations("tours.workspace.finance");
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  if (receipts.length === 0) {
    return <p className="mt-1 text-xs text-muted-foreground">{t("detailNoRecentReceipts")}</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {receipts.map((receipt) => {
        const receiptStatus = normalizeReceiptStatus(receipt.status);
        const amountLabel =
          receipt.payment?.amount && receipt.payment?.currency
            ? formatMinorAmount(receipt.payment.amount, receipt.payment.currency, locale)
            : t("detailEvidenceUnknownValue");
        const uploadedAtLabel =
          formatDetailDate(locale, receipt.createdAt) ?? t("detailEvidenceUnknownValue");
        const paymentStatusLabel = receipt.payment?.status?.trim().length
          ? receipt.payment.status
          : t("detailEvidenceUnknownValue");
        const fileLabel =
          receipt.fileKey.trim().length > 0
            ? receiptFileLabel(receipt.fileKey)
            : t("detailEvidenceUnknownValue");
        const isExpanded = expandedReceiptId === receipt.id;

        return (
          <div key={receipt.id} className="rounded-md border bg-background/70 px-3 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="text-sm font-medium text-foreground">
                  {t(`detailEvidenceReceiptStatus_${receiptStatus}` as const)}
                </p>
                <p>
                  {t("detailEvidenceReceiptAmount")}: {amountLabel}
                </p>
                <p>
                  {t("detailEvidenceReceiptUploadedAt")}: {uploadedAtLabel}
                </p>
                <p>
                  {t("detailEvidenceReceiptPaymentStatus")}: {paymentStatusLabel}
                </p>
                <p>
                  {t("detailEvidenceReceiptFile")}: <span className="font-mono">{fileLabel}</span>
                </p>
                {receipt.note?.trim().length ? (
                  <p>
                    {t("detailEvidenceReceiptNote")}: {receipt.note.trim()}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setExpandedReceiptId((current) => (current === receipt.id ? null : receipt.id))
                }
              >
                {isExpanded ? t("detailEvidenceHideProof") : t("detailEvidenceShowProof")}
              </Button>
            </div>
            <ReceiptProofPreview
              receiptId={receipt.id}
              fileKey={receipt.fileKey}
              expanded={isExpanded}
              className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3"
            />
          </div>
        );
      })}
    </div>
  );
}
