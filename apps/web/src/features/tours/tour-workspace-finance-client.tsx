"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import { approveBookingWithoutPayment } from "@/features/bookings/booking-approve-actions-logic";
import { invalidateTourWorkspaceFinanceCache } from "@/features/tours/tour-workspace-finance-fetch-cache";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { buildFinanceCommercialMeaningHref } from "@/finance/finance-commercial-meaning-contract";
import { type OutstandingBalanceListItem } from "@/finance/finance-outstanding-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  buildTourFinanceHubHref,
  buildTourFinanceMoneyInbox,
  pickTourCollectionRollup,
  resolveSelectedWorkspacePaymentAction,
  shouldShowTourFinanceGuestTools,
  sumOutstandingRemainingMinor,
  TOUR_WORKSPACE_FINANCE_TEST_IDS,
  type TourFinanceGuestKind,
  type TourFinanceListFilter,
  type TourWorkspacePaymentActionEvent,
} from "@/features/tours/tour-workspace-finance-logic";
import { useTourWorkspaceChrome } from "@/features/tours/tour-workspace-chrome-context";
import { buildTourWorkspaceFinanceHref } from "@/features/tours/tour-workspace-header-logic";
import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import {
  hasActiveTourWorkspacePaymentSchedule,
  resolveTourWorkspaceDetailActionMode,
  resolveTourWorkspaceDetailActionRecommendation,
} from "@/features/tours/tour-workspace-payment-follow-up-actions";
import { TourWorkspacePaymentActionsSection } from "@/features/tours/tour-workspace-payment-actions-section";
import { TourWorkspacePaymentFollowUpRow } from "@/features/tours/tour-workspace-payment-follow-up-row";
import {
  filterPaymentFollowUpParticipants,
  findPaymentFollowUpParticipant,
  type PaymentFollowUpPrimaryActionKind,
  type TourWorkspacePaymentFollowUpParticipantRow,
} from "@/features/tours/tour-workspace-payment-follow-up-logic";
import { useTourWorkspacePaymentFollowUpList } from "@/features/tours/use-tour-workspace-payment-follow-up-list";
import { TourWorkspacePaymentEvidenceList } from "@/features/tours/tour-workspace-payment-evidence-list";
import { useTourWorkspacePaymentDetailData } from "@/features/tours/use-tour-workspace-payment-detail-data";
import type { ReceiptReviewResultBanner } from "@/finance/finance-receipt-review-content";
import type { TourWorkspacePaymentSummaryStatus } from "@/features/tours/tour-workspace-payment-follow-up-state";
import {
  WorkspaceMasterDetailLayout,
  WorkspaceStickyDetailCard,
} from "@/features/workspace-resource-panel/workspace-master-detail-layout";
import {
  type TourWorkspaceFinanceSection,
  useTourWorkspaceFinanceData,
} from "@/features/tours/use-tour-workspace-finance-data";
import {
  parseWorkspaceFocusRegistrationId,
  WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY,
  workspaceBasePath,
} from "@/features/tours/tour-workspace-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTextDirection } from "@/i18n/routing";
import { localizeFinanceMessage } from "@/i18n/resolve-finance-error-message";
import { cn } from "@/lib/utils";

type TourWorkspaceFinanceClientProps = {
  readonly tourId: string;
  readonly session: OperatorSessionContext;
};

const FILTERS: readonly TourFinanceListFilter[] = ["all", "unpaid", "partial"];

function mapFollowUpListKindToFinanceRowKind(
  kind: TourWorkspacePaymentFollowUpParticipantRow["listKind"]
): TourFinanceGuestKind {
  return kind === "partial" ? "partial" : "unpaid";
}

function followUpListKindBadgeClass(
  kind: TourWorkspacePaymentFollowUpParticipantRow["listKind"]
): string {
  if (kind === "partial") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
  if (kind === "settled") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (kind === "pending") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-300";
  }
  return "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-300";
}

function followUpListKindLabel(
  t: ReturnType<typeof useTranslations>,
  kind: TourWorkspacePaymentFollowUpParticipantRow["listKind"]
): string {
  if (kind === "partial") {
    return t("statusPartial");
  }
  if (kind === "settled") {
    return t("rowSettled");
  }
  if (kind === "pending") {
    return t("rowPending");
  }
  return t("statusUnpaid");
}

function detailStatusLabel(
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

function buildDetailAmountRows(
  selectedOutstanding: OutstandingBalanceListItem | null,
  locale: AppLocale,
  t: ReturnType<typeof useTranslations>
): readonly { readonly label: string; readonly value: string }[] {
  if (selectedOutstanding === null) {
    return [];
  }
  const { invoice } = selectedOutstanding;
  return [
    {
      label: t("expected"),
      value: formatMinorAmount(invoice.totalMinor, invoice.currency, locale),
    },
    {
      label: t("collected"),
      value: formatMinorAmount(invoice.paidMinor, invoice.currency, locale),
    },
    {
      label: t("remaining"),
      value: formatMinorAmount(invoice.remainingMinor, invoice.currency, locale),
    },
  ];
}

function degradedSectionLabel(
  t: ReturnType<typeof useTranslations>,
  section: TourWorkspaceFinanceSection
): string {
  if (section === "outstanding") {
    return t("degradedOutstanding");
  }
  if (section === "tours") {
    return t("degradedTours");
  }
  return t("degradedReceipts");
}

function formatDetailDate(locale: AppLocale, value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return new Date(value).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-US");
}

/**
 * H-10/H-11 — Tour Money Inbox (this tour only; not Finance Hub).
 * Master-detail adaptation: signal list stays in workspace context, decision detail opens beside it.
 */
export function TourWorkspaceFinanceClient({ tourId, session }: TourWorkspaceFinanceClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace.finance");
  const tPayments = useTranslations("finance.payments");
  const tErrors = useTranslations("finance.errors");
  const tValidation = useTranslations("finance.validation");
  const dir = resolveTextDirection(locale);
  const router = useRouter();
  const pathname = usePathname() ?? workspaceBasePath(tourId);
  const searchParams = useSearchParams();
  const { reloadWorkspaceChrome } = useTourWorkspaceChrome();
  const focusFromUrl = parseWorkspaceFocusRegistrationId(
    searchParams.get(WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY)
  );
  const canManage = isAdminOrOwnerRole(session.role);

  const [listFilter, setListFilter] = useState<TourFinanceListFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(focusFromUrl);
  const [missedFocusId, setMissedFocusId] = useState<string | null>(null);
  const [highlightedRegistrationId, setHighlightedRegistrationId] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [lastPaymentAction, setLastPaymentAction] =
    useState<TourWorkspacePaymentActionEvent | null>(null);
  const [financeMutationRefreshKey, setFinanceMutationRefreshKey] = useState(0);
  const [followUpListRefreshKey, setFollowUpListRefreshKey] = useState(0);
  const [rowActionBusy, setRowActionBusy] = useState(false);
  const [workspaceExitNotice, setWorkspaceExitNotice] = useState<string | null>(null);
  const [receiptReviewNotice, setReceiptReviewNotice] = useState<string | null>(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const {
    loading,
    panelBlocking,
    error,
    outstanding,
    tours,
    receipts,
    receiptsHasMore,
    guestRowsHasMore,
    loadingMore,
    degradedSections,
    loadSucceeded,
    refresh,
    loadMore,
  } = useTourWorkspaceFinanceData(tourId);
  const followUpList = useTourWorkspacePaymentFollowUpList(tourId, followUpListRefreshKey);

  useEffect(() => {
    setPendingFocusId(focusFromUrl);
  }, [focusFromUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
    };
  }, []);

  const rollup = useMemo(() => pickTourCollectionRollup(tours, tourId), [tourId, tours]);
  const inbox = useMemo(
    () =>
      buildTourFinanceMoneyInbox({
        outstanding,
        pendingReceipts: receipts,
      }),
    [outstanding, receipts]
  );

  const clearFocusFromUrl = useCallback(() => {
    if (!searchParams.has(WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY)) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete(WORKSPACE_FOCUS_REGISTRATION_QUERY_KEY);
    const qs = next.toString();
    router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (panelBlocking || !loadSucceeded || followUpList.loading || pendingFocusId === null) {
      return;
    }
    const found = findPaymentFollowUpParticipant(followUpList.rows, pendingFocusId);
    if (found !== null) {
      setListFilter("all");
      setSearchQuery("");
      setHighlightedRegistrationId(found.registrationId);
      setSelectedRowKey(found.key);
      setMobileSheetOpen(isNarrowViewport);
      setMissedFocusId(null);
      setPendingFocusId(null);
      clearFocusFromUrl();
      return;
    }
    setMissedFocusId(pendingFocusId);
    setHighlightedRegistrationId(null);
    setPendingFocusId(null);
    clearFocusFromUrl();
  }, [
    clearFocusFromUrl,
    followUpList.loading,
    followUpList.rows,
    isNarrowViewport,
    loadSucceeded,
    panelBlocking,
    pendingFocusId,
  ]);

  const visibleRows = useMemo(
    () => filterPaymentFollowUpParticipants(followUpList.rows, listFilter, searchQuery),
    [followUpList.rows, listFilter, searchQuery]
  );

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedRowKey(null);
      setMobileSheetOpen(false);
      return;
    }
    setSelectedRowKey((current) =>
      current !== null && visibleRows.some((row) => row.key === current)
        ? current
        : visibleRows[0]!.key
    );
  }, [visibleRows]);

  const showGuestTools =
    !panelBlocking &&
    !followUpList.loading &&
    (shouldShowTourFinanceGuestTools(inbox) || followUpList.rows.length > 0);
  const selectedRow = useMemo(
    () => visibleRows.find((row) => row.key === selectedRowKey) ?? null,
    [selectedRowKey, visibleRows]
  );
  const selectedOutstanding = useMemo(
    () =>
      selectedRow?.registrationId != null
        ? (outstanding.find((row) => row.registrationId === selectedRow.registrationId) ?? null)
        : null,
    [outstanding, selectedRow]
  );
  const selectedPaymentAction = useMemo(
    () =>
      resolveSelectedWorkspacePaymentAction({
        lastPaymentAction,
        selectedRow:
          selectedRow === null
            ? null
            : {
                key: selectedRow.key,
                kind: mapFollowUpListKindToFinanceRowKind(selectedRow.listKind),
                registrationId: selectedRow.registrationId,
                displayName: selectedRow.displayName,
                amountMinor: selectedRow.remainingMinor,
                currency: selectedRow.currency,
              },
        selectedReceiptId: null,
      }),
    [lastPaymentAction, selectedRow]
  );
  const detailAmountRows = useMemo(
    () => buildDetailAmountRows(selectedOutstanding, locale, t),
    [locale, selectedOutstanding, t]
  );
  const detailData = useTourWorkspacePaymentDetailData(
    selectedRow?.registrationId ?? null,
    receipts
  );

  const refreshWorkspaceFinanceView = useCallback(() => {
    refresh();
    setFollowUpListRefreshKey((current) => current + 1);
    followUpList.refresh();
    reloadWorkspaceChrome();
  }, [followUpList, refresh, reloadWorkspaceChrome]);

  const runFollowUpRowAction = useCallback(
    async (action: PaymentFollowUpPrimaryActionKind, registrationId: string) => {
      if (action === "none" || action === "follow_up_payment" || action === "follow_up_partial") {
        const row = findPaymentFollowUpParticipant(followUpList.rows, registrationId);
        if (row !== null) {
          setSelectedRowKey(row.key);
          if (isNarrowViewport) {
            setMobileSheetOpen(true);
          }
        }
        return;
      }
      setRowActionBusy(true);
      try {
        if (action === "approve_awaiting_payment") {
          const response = await fetch(
            `/api/bookings/${encodeURIComponent(registrationId)}/approve`,
            { method: "POST", headers: { "Content-Type": "application/json" } }
          );
          if (!response.ok) {
            throw new Error(`BOOKINGS_APPROVE_HTTP_${response.status}`);
          }
          invalidateFinanceRegistrationCaches(registrationId);
        } else if (action === "approve_without_payment") {
          await approveBookingWithoutPayment(registrationId);
        }
        invalidateTourWorkspaceFinanceCache(tourId);
        refreshWorkspaceFinanceView();
      } finally {
        setRowActionBusy(false);
      }
    },
    [followUpList.rows, isNarrowViewport, refreshWorkspaceFinanceView, tourId]
  );

  const handleRegistrationPaymentChanged = useCallback(
    (event: TourWorkspacePaymentActionEvent) => {
      setLastPaymentAction(event);
      setFinanceMutationRefreshKey((current) => current + 1);
      setHighlightedRegistrationId(event.registrationId);
      setListFilter("all");
      setSearchQuery("");
      setPendingFocusId(event.registrationId);
      if (selectedRow?.registrationId === event.registrationId) {
        detailData.refresh();
      }
      refreshWorkspaceFinanceView();
    },
    [detailData, refreshWorkspaceFinanceView, selectedRow]
  );

  const handleReceiptReviewed = useCallback(
    (result: ReceiptReviewResultBanner) => {
      setReceiptReviewNotice(
        result.decision === "approve"
          ? t("detailReceiptApprovedNotice")
          : t("detailReceiptRejectedNotice")
      );
      setFinanceMutationRefreshKey((current) => current + 1);
      const registrationId = result.registrationId?.trim() ?? selectedRow?.registrationId ?? null;
      if (registrationId !== null) {
        setHighlightedRegistrationId(registrationId);
        setPendingFocusId(registrationId);
      }
      detailData.refresh();
      refreshWorkspaceFinanceView();
    },
    [detailData, refreshWorkspaceFinanceView, selectedRow, t]
  );

  const pendingReceiptsForSelected = useMemo(
    () =>
      detailData.receipts.filter((receipt) => receipt.status.trim().toLowerCase() === "pending"),
    [detailData.receipts]
  );

  useEffect(() => {
    if (highlightedRegistrationId === null) {
      return;
    }
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(highlightedRegistrationId)
        : highlightedRegistrationId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const node = document.querySelector(`[data-finance-registration-id="${escaped}"]`);
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedRegistrationId, visibleRows]);

  const queueRemainingMinor = useMemo(
    () => sumOutstandingRemainingMinor([...inbox.awaitingPayment, ...inbox.partialOutstanding]),
    [inbox.awaitingPayment, inbox.partialOutstanding]
  );
  const queueCurrency =
    inbox.awaitingPayment[0]?.invoice.currency ??
    inbox.partialOutstanding[0]?.invoice.currency ??
    rollup?.currency ??
    null;
  const remainingTotalLabel =
    inbox.guestRows.length > 0 && queueCurrency !== null
      ? formatMinorAmount(queueRemainingMinor, queueCurrency, locale)
      : null;

  const queueLabel =
    inbox.guestRows.length === 1
      ? t("guestsAwaitingPaymentOne")
      : t("guestsAwaitingPayment", {
          count: formatLocalizedNumber(inbox.guestRows.length, locale),
        });

  const receiptsLabel =
    receipts.length === 1 && !receiptsHasMore
      ? t("receiptsNeedReviewOne")
      : t("receiptsNeedReview", {
          count: formatLocalizedNumber(receipts.length, locale) + (receiptsHasMore ? "+" : ""),
        });

  const renderDetailBody = (mobile = false) => {
    if (selectedRow === null) {
      return (
        <p
          className="text-sm text-muted-foreground"
          data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.detailEmpty}
        >
          {t("detailEmpty")}
        </p>
      );
    }
    const paymentActionBanner =
      selectedPaymentAction !== null ? (
        <div
          className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2"
          role="status"
          data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.paymentActionResult}
          data-action-kind={selectedPaymentAction.kind}
        >
          <p className="text-sm font-medium">
            {selectedPaymentAction.kind === "prepayment_recorded"
              ? t("workspacePaymentRecordedTitle")
              : tPayments("receiptSubmittedTitle")}
          </p>
          {selectedPaymentAction.kind === "prepayment_recorded" ? (
            <p className="text-xs text-muted-foreground">{t("workspacePaymentRecordedHint")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("detailReceiptSubmittedHint")}</p>
          )}
        </div>
      ) : null;

    const selectedAmountLabel =
      selectedRow.remainingMinor !== null && selectedRow.currency !== null
        ? formatMinorAmount(selectedRow.remainingMinor, selectedRow.currency, locale)
        : null;
    const selectedDeadlineLabel =
      selectedRow.paymentDueAt !== null
        ? formatDetailDate(locale, selectedRow.paymentDueAt)
        : null;
    const requirementAmountLabel =
      detailData.detailState !== null &&
      detailData.detailState.currentRequirement.amountMinor !== "0" &&
      detailData.invoice !== null
        ? formatMinorAmount(
            detailData.detailState.currentRequirement.amountMinor,
            detailData.invoice.currency,
            locale
          )
        : null;
    const recentPayments = detailData.payments.slice(0, 3);
    const recentReceipts = detailData.receipts.slice(0, 3);
    const pendingReceiptsCount = pendingReceiptsForSelected.length;
    const hasActiveSchedule = hasActiveTourWorkspacePaymentSchedule(detailData.schedule);
    const actionMode =
      pendingReceiptsCount > 0
        ? "review_receipt"
        : detailData.detailState !== null
          ? resolveTourWorkspaceDetailActionMode(detailData.detailState.summaryStatus)
          : "active";
    const requirementDueAtLabel =
      detailData.detailState?.currentRequirement.kind === "schedule_item"
        ? formatDetailDate(locale, detailData.detailState.currentRequirement.dueAt)
        : null;
    const latestReceiptAtLabel = formatDetailDate(
      locale,
      detailData.detailState?.evidence.latestReceiptAt ?? null
    );

    return (
      <div className="space-y-4">
        {paymentActionBanner}
        {receiptReviewNotice !== null ? (
          <p
            className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
            role="status"
          >
            {receiptReviewNotice}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={followUpListKindBadgeClass(selectedRow.listKind)}>
            {followUpListKindLabel(t, selectedRow.listKind)}
          </Badge>
          {selectedAmountLabel !== null ? (
            <span className="text-sm text-muted-foreground">{selectedAmountLabel}</span>
          ) : null}
          {selectedDeadlineLabel !== null ? (
            <span className="text-sm text-muted-foreground">
              {t("rowDeadline", { date: selectedDeadlineLabel })}
            </span>
          ) : null}
        </div>

        {detailData.loading && detailData.invoice === null ? (
          <div className="space-y-2">
            <OperatorSkeleton size="user-card" />
          </div>
        ) : null}

        {detailData.error !== null ? (
          <p className="text-sm text-destructive">
            {localizeFinanceMessage(tValidation, tErrors, detailData.error)}
          </p>
        ) : null}

        {detailData.detailState !== null ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border bg-background/70 px-3 py-3">
                <p className="text-xs text-muted-foreground">{t("detailStatusCardTitle")}</p>
                <p className="mt-1 text-sm font-medium">
                  {detailStatusLabel(t, detailData.detailState.summaryStatus)}
                </p>
              </div>
              <div className="rounded-md border bg-background/70 px-3 py-3">
                <p className="text-xs text-muted-foreground">{t("detailRequirementTitle")}</p>
                <p className="mt-1 text-sm font-medium">
                  {requirementAmountLabel ?? t("detailRequirementNone")}
                </p>
              </div>
            </div>
            {detailAmountRows.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {detailAmountRows.map((item) => (
                  <div key={item.label} className="rounded-md border bg-background/70 px-3 py-3">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {(() => {
              const recommendation = resolveTourWorkspaceDetailActionRecommendation({
                status: detailData.detailState.summaryStatus,
                hasActiveSchedule,
              });
              return (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.detailRecommendation}
                >
                  {t(recommendation.titleKey)}
                </p>
              );
            })()}

            <details className="rounded-md border border-dashed px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                {t("detailRequirementBlockTitle")}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>{t("detailRequirementBlockDescription")}</p>
                <p>
                  {t("detailRequirementSource")}:{" "}
                  {detailData.detailState.currentRequirement.source === "schedule"
                    ? t("detailRequirementSourceSchedule")
                    : detailData.detailState.currentRequirement.source === "invoice"
                      ? t("detailRequirementSourceInvoice")
                      : t("detailRequirementSourceNone")}
                </p>
                {detailData.detailState.currentRequirement.kind === "schedule_item" ? (
                  <p>
                    {t("detailRequirementScheduleLabel")}:{" "}
                    {detailData.detailState.currentRequirement.label}
                  </p>
                ) : null}
                {requirementDueAtLabel !== null ? (
                  <p>
                    {t("detailRequirementDueAt")}: {requirementDueAtLabel}
                  </p>
                ) : null}
                {detailData.detailState.currentRequirement.kind === "schedule_item" ? (
                  <p>
                    {t("detailRequirementScheduleStatus")}:{" "}
                    {detailData.detailState.currentRequirement.status}
                  </p>
                ) : null}
              </div>
            </details>

            <details className="rounded-md border border-dashed px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                {t("detailEvidenceTitle")}
              </summary>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("detailPendingReceiptsCount", {
                      count: formatLocalizedNumber(
                        detailData.detailState.evidence.pendingReceiptsCount,
                        locale
                      ),
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("detailPortalReceiptHint")}</p>
                  <TourWorkspacePaymentEvidenceList
                    receipts={recentReceipts}
                    locale={locale}
                    formatDetailDate={formatDetailDate}
                  />
                </div>
                <div className="space-y-3">
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("detailNoRecentPayments")}
                      </p>
                    )}
                  </div>
                  <div className="rounded-md border bg-background/70 px-3 py-3">
                    <p className="text-xs text-muted-foreground">{t("detailActivityTitle")}</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        {t("detailManualPendingCount", {
                          count: formatLocalizedNumber(
                            detailData.detailState.evidence.pendingManualPaymentsCount,
                            locale
                          ),
                        })}
                      </p>
                      <p>
                        {t("detailPaidPaymentsCount", {
                          count: formatLocalizedNumber(
                            detailData.detailState.evidence.paidPaymentsCount,
                            locale
                          ),
                        })}
                      </p>
                      <p>
                        {t("detailCancelledPaymentsCount", {
                          count: formatLocalizedNumber(
                            detailData.detailState.evidence.cancelledPaymentsCount,
                            locale
                          ),
                        })}
                      </p>
                      {latestReceiptAtLabel !== null ? (
                        <p>
                          {t("detailLatestReceiptAt")}: {latestReceiptAtLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : null}

        {selectedRow.listKind !== "pending" && selectedRow.registrationId !== null ? (
          <TourWorkspacePaymentActionsSection
            tourId={tourId}
            pluginId={session.pluginId}
            registrationId={selectedRow.registrationId}
            canManage={canManage}
            actionMode={actionMode}
            hasActiveSchedule={hasActiveSchedule}
            rowKind={mapFollowUpListKindToFinanceRowKind(selectedRow.listKind)}
            invoice={detailData.invoice}
            pendingReceipts={pendingReceiptsForSelected}
            refreshKey={financeMutationRefreshKey}
            onOverrideChanged={(event) => {
              setFinanceMutationRefreshKey((current) => current + 1);
              setWorkspaceExitNotice(
                event.obligationMinor === "0"
                  ? t("detailExitNoticeNoPayment", {
                      guest: selectedRow.displayName,
                    })
                  : t("detailExitNoticeBalanceUpdated", {
                      guest: selectedRow.displayName,
                    })
              );
              detailData.refresh();
              refreshWorkspaceFinanceView();
            }}
            onPaymentChanged={handleRegistrationPaymentChanged}
            onReceiptReviewed={handleReceiptReviewed}
          />
        ) : null}

        {detailAmountRows.length > 0 && selectedRow.registrationId === null ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {detailAmountRows.map((item) => (
              <div key={item.label} className="rounded-md border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className={cn("flex flex-wrap gap-2", mobile && "w-full")}>
          {selectedRow.registrationId !== null ? (
            <Button asChild size="sm" variant="ghost">
              <OperatorInternalLink
                href={buildFinanceCommercialMeaningHref(selectedRow.registrationId)}
                data-testid={`${TOUR_WORKSPACE_FINANCE_TEST_IDS.openCase}-${selectedRow.registrationId}`}
              >
                {t("ctaOpenCase")}
              </OperatorInternalLink>
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const detailPanel = (
    <WorkspaceStickyDetailCard
      title={selectedRow?.displayName ?? t("detailTitle")}
      description={t("detailTitle")}
      testId={TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel}
    >
      {renderDetailBody()}
    </WorkspaceStickyDetailCard>
  );

  const listPanel = (
    <section className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold">{t("guestListTitle")}</h3>
      {followUpList.loading ? (
        <div className="space-y-2">
          <OperatorSkeleton size="user-card" />
          <OperatorSkeleton size="user-card" />
        </div>
      ) : visibleRows.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
          data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.empty}
        >
          {t("emptyFiltered")}
        </div>
      ) : (
        <ul className="space-y-2" data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList}>
          {visibleRows.map((row) => {
            const highlighted = row.registrationId === highlightedRegistrationId;
            const selected = row.key === selectedRowKey;
            return (
              <li key={row.key}>
                <TourWorkspacePaymentFollowUpRow
                  row={row}
                  locale={locale}
                  selected={selected}
                  highlighted={highlighted}
                  busy={rowActionBusy}
                  onSelect={() => {
                    setSelectedRowKey(row.key);
                    if (isNarrowViewport) {
                      setMobileSheetOpen(true);
                    }
                  }}
                  onPrimaryAction={(action, registrationId) => {
                    void runFollowUpRowAction(action, registrationId);
                  }}
                  onSecondaryAction={(action, registrationId) => {
                    void runFollowUpRowAction(action, registrationId);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
      {guestRowsHasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? t("guestListLoadingMore") : t("guestListLoadMore")}
          </Button>
        </div>
      ) : null}
    </section>
  );

  return (
    <Card
      data-operator-surface="card"
      className="shadow-sm"
      data-testid={TOUR_WORKSPACE_TEST_IDS.financePanel}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={refreshWorkspaceFinanceView}
        >
          {t("refreshQueue")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5" data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.panel}>
        {error !== null ? (
          <p className="text-sm text-destructive">
            {localizeFinanceMessage(tValidation, tErrors, error)}
          </p>
        ) : null}

        {panelBlocking ? (
          <div className="space-y-2">
            <OperatorSkeleton size="user-card" />
            <OperatorSkeleton size="user-card" />
          </div>
        ) : null}

        {!panelBlocking && missedFocusId !== null ? (
          <p
            className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
            data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.focusMiss}
          >
            {t("focusMiss")}{" "}
            <OperatorInternalLink
              href={buildFinanceCommercialMeaningHref(missedFocusId)}
              className="underline-offset-2 hover:underline"
              data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.openCase}
            >
              {t("ctaOpenCase")}
            </OperatorInternalLink>
          </p>
        ) : null}

        {workspaceExitNotice !== null ? (
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
            {workspaceExitNotice}
          </p>
        ) : null}

        {!panelBlocking && loadSucceeded && degradedSections.length > 0 ? (
          <div
            className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
            role="status"
            data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.degraded}
          >
            <p className="font-medium text-amber-950 dark:text-amber-200">{t("degradedTitle")}</p>
            <p className="text-muted-foreground">{t("degradedDescription")}</p>
            <p className="text-xs text-muted-foreground">
              {t("degradedAffected", {
                sections: degradedSections
                  .map((section) => degradedSectionLabel(t, section))
                  .join("، "),
              })}
            </p>
          </div>
        ) : null}

        {!panelBlocking && inbox.leadSection === "settled" ? (
          <div
            className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground"
            data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.allSettled}
          >
            {t("allSettled")}
          </div>
        ) : null}

        {!panelBlocking && inbox.leadSection !== "settled" ? (
          <div
            className="rounded-md border bg-muted/20 px-3 py-2 text-sm"
            data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.statusStrip}
          >
            <p className="font-medium">
              {inbox.guestRows.length > 0 ? queueLabel : null}
              {inbox.guestRows.length > 0 && remainingTotalLabel !== null
                ? ` · ${t("remainingTotal", { amount: remainingTotalLabel })}`
                : null}
              {receipts.length > 0 ? (
                <>
                  {inbox.guestRows.length > 0 || remainingTotalLabel !== null ? " · " : null}
                  <OperatorInternalLink
                    href={buildTourFinanceHubHref(tourId, "receipts")}
                    className="underline-offset-2 hover:underline"
                  >
                    {receiptsLabel}
                  </OperatorInternalLink>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        {showGuestTools ? (
          <div className="flex flex-col gap-3">
            <div
              className="flex flex-wrap gap-2"
              data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.filters}
              role="group"
              aria-label={t("filtersAria")}
            >
              {FILTERS.map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={listFilter === filter ? "default" : "outline"}
                  onClick={() => setListFilter(filter)}
                >
                  {t(`filter.${filter}`)}
                </Button>
              ))}
            </div>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.search}
              aria-label={t("searchPlaceholder")}
            />
          </div>
        ) : null}

        {showGuestTools ? (
          <WorkspaceMasterDetailLayout
            dir={dir}
            list={listPanel}
            detail={detailPanel}
            mobileDetail={selectedRow !== null ? renderDetailBody(true) : null}
            mobileDetailTitle={selectedRow?.displayName ?? null}
            mobileOpen={isNarrowViewport && mobileSheetOpen}
            onMobileOpenChange={setMobileSheetOpen}
          />
        ) : null}

        {!panelBlocking ? (
          <div className="space-y-2 border-t pt-4">
            <p
              className="text-xs text-muted-foreground"
              data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.rollup}
            >
              <span className="font-medium">{t("rollupTitle")}: </span>
              {t("expected")}{" "}
              {rollup !== null
                ? formatMinorAmount(rollup.invoiceTotalMinor, rollup.currency, locale)
                : "—"}
              {" · "}
              {t("collected")}{" "}
              {rollup !== null
                ? formatMinorAmount(rollup.collectedMinor, rollup.currency, locale)
                : "—"}
              {" · "}
              {t("remaining")}{" "}
              {rollup !== null
                ? formatMinorAmount(rollup.remainingMinor, rollup.currency, locale)
                : "—"}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <OperatorInternalLink
                href={buildTourFinanceHubHref(tourId, "payments")}
                className="underline-offset-2 hover:underline"
                data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.openPayments}
              >
                {t("escapePaymentsHub")}
              </OperatorInternalLink>
              <OperatorInternalLink
                href={buildTourWorkspaceFinanceHref(tourId)}
                className="underline-offset-2 hover:underline"
                data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.openHub}
              >
                {t("escapeFullHub")}
              </OperatorInternalLink>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
