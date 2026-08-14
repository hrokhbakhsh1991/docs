"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { BookingFinancialStrip } from "@/finance/booking-financial-strip";
import { TourWorkspaceAdvancedReceiptCard } from "@/features/tours/tour-workspace-advanced-receipt-card";
import type { RegistrationInvoice } from "@/finance/finance-invoice-logic";
import { TourWorkspaceAdminPaymentCard } from "@/features/tours/tour-workspace-admin-payment-card";
import type { TourWorkspacePaymentActionEvent } from "@/features/tours/tour-workspace-finance-logic";
import { buildTourFinanceHubHref } from "@/features/tours/tour-workspace-finance-logic";
import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import {
  resolveTourWorkspaceDetailActionRecommendation,
  type TourWorkspaceDetailActionMode,
} from "@/features/tours/tour-workspace-payment-follow-up-actions";
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
  readonly refreshKey?: string | number;
  readonly onOverrideChanged: (event: {
    readonly registrationId: string;
    readonly obligationMinor: string;
  }) => void;
  readonly onPaymentChanged: (event: TourWorkspacePaymentActionEvent) => void;
};

function ActionBlock({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={["rounded-md border px-3 py-3", className].filter(Boolean).join(" ")}>
      <div className="space-y-1">
        {eyebrow ? <p className="text-xs text-muted-foreground">{eyebrow}</p> : null}
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function TourWorkspacePaymentActionsSection({
  tourId,
  registrationId,
  canManage,
  actionMode,
  summaryStatus,
  hasActiveSchedule,
  rowKind,
  invoice,
  refreshKey,
  onOverrideChanged,
  onPaymentChanged,
}: TourWorkspacePaymentActionsSectionProps) {
  const t = useTranslations("tours.workspace.finance");
  const recommendation =
    summaryStatus !== null
      ? resolveTourWorkspaceDetailActionRecommendation({
          status: summaryStatus,
          hasActiveSchedule,
        })
      : null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("detailActionsTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("detailActionsDescription")}</p>
      </div>
      {recommendation !== null ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-xs text-muted-foreground">{t("detailPrimaryActionEyebrow")}</p>
          <p className="mt-1 text-sm font-medium">{t(recommendation.titleKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(recommendation.bodyKey)}</p>
        </div>
      ) : null}
      {actionMode === "review_receipt" ? (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
          <p className="text-xs text-muted-foreground">{t("detailPrimaryActionEyebrow")}</p>
          <p className="text-sm font-medium">{t("detailActionStateReviewTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("detailActionStateReviewDescription")}
          </p>
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <OperatorInternalLink
                href={buildTourFinanceHubHref(tourId, "receipts", registrationId)}
              >
                {t("detailActionStateReviewCta")}
              </OperatorInternalLink>
            </Button>
          </div>
        </div>
      ) : null}
      {actionMode === "read_only" ? (
        <div className="rounded-md border px-3 py-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("detailPrimaryActionEyebrow")}</p>
            <p className="text-sm font-medium">{t("detailActionStateReadOnlyTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("detailActionStateReadOnlyDescription")}
            </p>
          </div>
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <OperatorInternalLink
                href={buildTourFinanceHubHref(tourId, "payments", registrationId)}
              >
                {t("detailActionStateReadOnlyCta")}
              </OperatorInternalLink>
            </Button>
          </div>
        </div>
      ) : null}
      {actionMode === "active" ? (
        <>
          {!canManage ? (
            <div className="rounded-md border px-3 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("detailActionStateAccessTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("detailActionStateAccessDescription")}
                </p>
              </div>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <OperatorInternalLink
                    href={buildTourFinanceHubHref(tourId, "payments", registrationId)}
                  >
                    {t("detailActionStateAccessCta")}
                  </OperatorInternalLink>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ActionBlock
                eyebrow={t("detailPrimaryActionEyebrow")}
                title={t("detailPrimaryPaymentTitle")}
                description={
                  rowKind === "partial"
                    ? t("detailPrimaryPaymentDescriptionPartial")
                    : t("detailPrimaryPaymentDescriptionUnpaid")
                }
                className="border-primary/20 bg-primary/5"
              >
                <TourWorkspaceAdminPaymentCard
                  registrationId={registrationId}
                  canManage={canManage}
                  refreshKey={refreshKey}
                  onChanged={onPaymentChanged}
                />
              </ActionBlock>
              <BookingFinancialStrip
                registrationId={registrationId}
                bookingPaymentStatus={rowKind}
                bookingStatus="approved"
                refreshKey={refreshKey}
              />
              <ActionBlock
                eyebrow={t("detailSecondaryActionEyebrow")}
                title={t("detailSecondaryActionTitle")}
                description={t("detailSecondaryActionDescription")}
                className="border-dashed"
              >
                <TourWorkspacePaymentOverrideActions
                  registrationId={registrationId}
                  canManage={canManage}
                  invoice={invoice}
                  hasActiveSchedule={hasActiveSchedule}
                  onChanged={onOverrideChanged}
                />
              </ActionBlock>
              <TourWorkspaceAdvancedReceiptCard
                registrationId={registrationId}
                canManage={canManage}
                onChanged={onPaymentChanged}
              />
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
