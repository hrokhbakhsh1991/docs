"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { TourFinanceGuestKind } from "@/features/tours/tour-workspace-finance-logic";
import type { TourWorkspacePaymentDetailState } from "@/features/tours/tour-workspace-payment-follow-up-state";
import type { TourWorkspacePaymentSummaryStatus } from "@/features/tours/tour-workspace-payment-follow-up-state";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type TourWorkspaceFinanceDetailHeroProps = {
  readonly summaryStatus: TourWorkspacePaymentSummaryStatus;
  readonly detailState: TourWorkspacePaymentDetailState;
  readonly amountRows: readonly { readonly label: string; readonly value: string }[];
  readonly rowKind: TourFinanceGuestKind;
  readonly locale: AppLocale;
  readonly formatDetailDate: (locale: AppLocale, value: string | null) => string | null;
};

function kindBadgeClass(kind: TourFinanceGuestKind): string {
  if (kind === "partial") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
  return "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-300";
}

function summaryStatusLabel(
  t: ReturnType<typeof useTranslations>,
  status: TourWorkspacePaymentSummaryStatus
): string {
  switch (status) {
    case "needs_payment":
      return t("detailStatusNeedsPayment");
    case "payment_under_review":
      return t("detailStatusUnderReview");
    case "paid_in_full":
      return t("detailStatusPaidInFull");
    case "no_payment_required":
      return t("detailStatusNoPaymentRequired");
    case "overdue":
      return t("detailStatusOverdue");
    case "credit_balance":
      return t("detailStatusCreditBalance");
    default:
      return t("detailStatusUnknown");
  }
}

function kindStatusLabel(
  t: ReturnType<typeof useTranslations>,
  kind: TourFinanceGuestKind
): string {
  return kind === "partial" ? t("statusPartial") : t("statusUnpaid");
}

export function TourWorkspaceFinanceDetailHero({
  summaryStatus,
  detailState,
  amountRows,
  rowKind,
  locale,
  formatDetailDate,
}: TourWorkspaceFinanceDetailHeroProps) {
  const t = useTranslations("tours.workspace.finance");
  const remainingRow = amountRows.find((row) => row.label === t("remaining"));
  const heroAmount = remainingRow?.value ?? amountRows.at(-1)?.value ?? "—";
  const pendingReceipts = detailState.evidence.pendingReceiptsCount;
  const dueAtLabel =
    detailState.currentRequirement.kind === "schedule_item"
      ? formatDetailDate(locale, detailState.currentRequirement.dueAt)
      : null;

  return (
    <div
      className="rounded-lg border bg-gradient-to-b from-muted/30 to-background px-4 py-4"
      data-testid="operator-tour-workspace-finance-detail-hero"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={kindBadgeClass(rowKind)}>
              {kindStatusLabel(t, rowKind)}
            </Badge>
            <Badge variant="secondary">{summaryStatusLabel(t, summaryStatus)}</Badge>
            {pendingReceipts > 0 ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10">
                {t("detailPendingReceiptsCount", {
                  count: formatLocalizedNumber(pendingReceipts, locale),
                })}
              </Badge>
            ) : null}
          </div>
          {dueAtLabel !== null ? (
            <p className="text-xs text-muted-foreground">
              {t("detailRequirementDueAt")}: {dueAtLabel}
            </p>
          ) : null}
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{t("remaining")}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{heroAmount}</p>
        </div>
      </div>
      {amountRows.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
          {amountRows.map((item) => (
            <div key={item.label} className="min-w-0 text-center sm:text-start">
              <p className="truncate text-[11px] text-muted-foreground">{item.label}</p>
              <p className="truncate text-sm font-medium tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
