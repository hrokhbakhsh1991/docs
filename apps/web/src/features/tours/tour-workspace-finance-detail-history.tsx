"use client";

import { useTranslations } from "next-intl";

import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import type { FinancePaymentRow } from "@/finance/finance-payments-logic";
import type { FinancePendingReceipt } from "@/finance/finance-receipts-logic";
import { TourWorkspacePaymentEvidenceList } from "@/features/tours/tour-workspace-payment-evidence-list";
import type { TourWorkspacePaymentDetailState } from "@/features/tours/tour-workspace-payment-follow-up-state";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";

type TourWorkspaceFinanceDetailHistoryProps = {
  readonly detailState: TourWorkspacePaymentDetailState;
  readonly payments: readonly FinancePaymentRow[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly locale: AppLocale;
  readonly formatDetailDate: (locale: AppLocale, value: string | null) => string | null;
};

export function TourWorkspaceFinanceDetailHistory({
  detailState,
  payments,
  receipts,
  locale,
  formatDetailDate,
}: TourWorkspaceFinanceDetailHistoryProps) {
  const t = useTranslations("tours.workspace.finance");
  const recentPayments = payments.slice(0, 5);
  const historyReceipts = receipts.filter(
    (row) => row.status.trim().toLowerCase() !== "pending"
  );
  const latestReceiptAtLabel = formatDetailDate(
    locale,
    detailState.evidence.latestReceiptAt ?? null
  );

  return (
    <details className="rounded-lg border bg-muted/10 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">{t("detailHistoryToggle")}</summary>
      <div className="mt-4 space-y-4">
        {historyReceipts.length > 0 ? (
          <TourWorkspacePaymentEvidenceList
            receipts={historyReceipts}
            locale={locale}
            formatDetailDate={formatDetailDate}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t("detailNoRecentReceipts")}</p>
        )}
        <div>
          <p className="text-sm font-medium">
            {t("detailRecentPaymentsCount", {
              count: formatLocalizedNumber(recentPayments.length, locale),
            })}
          </p>
          {recentPayments.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {recentPayments.map((payment) => (
                <li key={payment.id}>
                  {formatMinorAmount(payment.amount, payment.currency, locale)}
                  {" · "}
                  {payment.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("detailNoRecentPayments")}</p>
          )}
        </div>
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            {t("detailManualPendingCount", {
              count: formatLocalizedNumber(
                detailState.evidence.pendingManualPaymentsCount,
                locale
              ),
            })}
          </p>
          <p>
            {t("detailPaidPaymentsCount", {
              count: formatLocalizedNumber(detailState.evidence.paidPaymentsCount, locale),
            })}
          </p>
          {latestReceiptAtLabel !== null ? (
            <p>
              {t("detailLatestReceiptAt")}: {latestReceiptAtLabel}
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}
