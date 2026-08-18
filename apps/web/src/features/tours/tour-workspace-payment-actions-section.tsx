"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BookingFinancialStrip } from "@/finance/booking-financial-strip";
import type { ReceiptReviewResultBanner } from "@/finance/finance-receipt-review-content";
import type { RegistrationInvoice } from "@/finance/finance-invoice-logic";
import type { FinancePendingReceipt } from "@/finance/finance-receipts-logic";
import { TourWorkspaceAdvancedReceiptCard } from "@/features/tours/tour-workspace-advanced-receipt-card";
import { TourWorkspaceAdminPaymentCard } from "@/features/tours/tour-workspace-admin-payment-card";
import { TourWorkspaceInlineReceiptReview } from "@/features/tours/tour-workspace-inline-receipt-review";
import type { TourWorkspacePaymentActionEvent } from "@/features/tours/tour-workspace-finance-logic";
import { buildTourFinanceHubHref } from "@/features/tours/tour-workspace-finance-logic";
import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import type { TourWorkspaceDetailActionMode } from "@/features/tours/tour-workspace-payment-follow-up-actions";
import { TourWorkspacePaymentOverrideActions } from "@/features/tours/tour-workspace-payment-override-actions";
import type { TourWorkspacePaymentSummaryStatus } from "@/features/tours/tour-workspace-payment-follow-up-state";

type TourWorkspacePaymentActionsSectionProps = {
  readonly tourId: string;
  readonly registrationId: string;
  readonly canManage: boolean;
  readonly actionMode: TourWorkspaceDetailActionMode;
  readonly summaryStatus: TourWorkspacePaymentSummaryStatus | null;
  readonly hasActiveSchedule: boolean;
  readonly rowKind: "unpaid" | "partial";
  readonly invoice: RegistrationInvoice | null;
  readonly pendingReceipts: readonly FinancePendingReceipt[];
  readonly refreshKey?: string | number;
  readonly onOverrideChanged: (event: {
    readonly registrationId: string;
    readonly obligationMinor: string;
  }) => void;
  readonly onPaymentChanged: (event: TourWorkspacePaymentActionEvent) => void;
  readonly onReceiptReviewed: (result: ReceiptReviewResultBanner) => void;
};

export function TourWorkspacePaymentActionsSection({
  tourId,
  registrationId,
  canManage,
  actionMode,
  hasActiveSchedule,
  rowKind,
  invoice,
  pendingReceipts,
  refreshKey,
  onOverrideChanged,
  onPaymentChanged,
  onReceiptReviewed,
}: TourWorkspacePaymentActionsSectionProps) {
  const t = useTranslations("tours.workspace.finance");

  if (actionMode === "review_receipt") {
    return (
      <section className="space-y-3" data-testid="operator-tour-workspace-finance-actions">
        <TourWorkspaceInlineReceiptReview
          receipts={pendingReceipts}
          canManage={canManage}
          onReviewed={onReceiptReviewed}
        />
        {!canManage ? (
          <p className="text-xs text-muted-foreground">{t("detailActionStateAccessDescription")}</p>
        ) : null}
      </section>
    );
  }

  if (actionMode === "read_only") {
    return (
      <section
        className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground"
        data-testid="operator-tour-workspace-finance-actions"
      >
        <p className="font-medium text-foreground">{t("detailActionStateReadOnlyTitle")}</p>
        <p className="mt-1 text-xs">{t("detailActionStateReadOnlyDescription")}</p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <OperatorInternalLink
            href={buildTourFinanceHubHref(tourId, "payments", registrationId)}
          >
            {t("detailActionStateReadOnlyCta")}
          </OperatorInternalLink>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="operator-tour-workspace-finance-actions">
      {!canManage ? (
        <div className="rounded-md border px-3 py-3 text-sm">
          <p className="font-medium">{t("detailActionStateAccessTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("detailActionStateAccessDescription")}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("detailPrimaryPaymentTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {rowKind === "partial"
                  ? t("detailPrimaryPaymentDescriptionPartial")
                  : t("detailPrimaryPaymentDescriptionUnpaid")}
              </p>
            </div>
            <TourWorkspaceAdminPaymentCard
              tourId={tourId}
              registrationId={registrationId}
              canManage={canManage}
              refreshKey={refreshKey}
              hideIntro
              onChanged={onPaymentChanged}
            />
          </div>
          <BookingFinancialStrip
            registrationId={registrationId}
            bookingPaymentStatus={rowKind}
            bookingStatus="approved"
            refreshKey={refreshKey}
          />
          <details className="rounded-md border border-dashed px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              {t("detailAdvancedToggle")}
            </summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("detailSecondaryActionTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("detailSecondaryActionDescription")}
                </p>
                <TourWorkspacePaymentOverrideActions
                  registrationId={registrationId}
                  canManage={canManage}
                  invoice={invoice}
                  hasActiveSchedule={hasActiveSchedule}
                  onChanged={onOverrideChanged}
                />
              </div>
              <TourWorkspaceAdvancedReceiptCard
                registrationId={registrationId}
                canManage={canManage}
                onChanged={onPaymentChanged}
              />
            </div>
          </details>
        </>
      )}
    </section>
  );
}
