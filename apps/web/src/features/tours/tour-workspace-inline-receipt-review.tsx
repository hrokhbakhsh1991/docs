"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  FinanceReceiptReviewContent,
  type ReceiptReviewResultBanner,
} from "@/finance/finance-receipt-review-content";
import { type FinancePendingReceipt } from "@/finance/finance-receipts-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "@/features/tours/tour-workspace-finance-logic";

type TourWorkspaceInlineReceiptReviewProps = {
  readonly receipts: readonly FinancePendingReceipt[];
  readonly canManage: boolean;
  readonly onReviewed: (result: ReceiptReviewResultBanner) => void;
};

function isPendingReceipt(receipt: FinancePendingReceipt): boolean {
  return receipt.status.trim().toLowerCase() === "pending";
}

export function TourWorkspaceInlineReceiptReview({
  receipts,
  canManage,
  onReviewed,
}: TourWorkspaceInlineReceiptReviewProps) {
  const t = useTranslations("tours.workspace.finance");
  const pending = useMemo(() => receipts.filter(isPendingReceipt), [receipts]);
  const now = useMemo(() => new Date(), []);

  if (pending.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
        {t("detailNoRecentReceipts")}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.inlineReceiptReview}>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("detailInlineReviewTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("detailInlineReviewDescription")}</p>
      </div>
      {pending.map((receipt) => (
        <div
          key={receipt.id}
          className="rounded-lg border bg-background px-3 py-3 shadow-sm"
          data-testid={`${TOUR_WORKSPACE_FINANCE_TEST_IDS.inlineReceiptReview}-${receipt.id}`}
        >
          <FinanceReceiptReviewContent
            receipt={receipt}
            canManage={canManage}
            onReviewed={onReviewed}
            now={now}
            showIdentity={false}
          />
        </div>
      ))}
    </div>
  );
}
