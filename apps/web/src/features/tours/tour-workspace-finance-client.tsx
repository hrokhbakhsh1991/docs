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
import { buildFinanceCommercialMeaningHref } from "@/finance/finance-commercial-meaning-contract";
import { type OutstandingBalanceListItem } from "@/finance/finance-outstanding-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  buildTourFinanceHubHref,
  buildTourFinanceMoneyInbox,
  filterTourFinanceGuestRows,
  findTourFinanceGuestRow,
  pickTourCollectionRollup,
  resolveSelectedWorkspacePaymentAction,
  shouldShowTourFinanceGuestTools,
  sumOutstandingRemainingMinor,
  TOUR_WORKSPACE_FINANCE_TEST_IDS,
  type TourFinanceGuestKind,
  type TourFinanceGuestRow,
  type TourFinanceListFilter,
  type TourWorkspacePaymentActionEvent,
} from "@/features/tours/tour-workspace-finance-logic";
import { useTourWorkspaceChrome } from "@/features/tours/tour-workspace-chrome-context";
import { buildTourWorkspaceFinanceHref } from "@/features/tours/tour-workspace-header-logic";
import { OperatorInternalLink } from "@/features/tours/tour-internal-link";
import {
  hasActiveTourWorkspacePaymentSchedule,
  resolveTourWorkspaceDetailActionMode,
} from "@/features/tours/tour-workspace-payment-follow-up-actions";
import { TourWorkspaceFinanceDetailHero } from "@/features/tours/tour-workspace-finance-detail-hero";
import { TourWorkspaceFinanceDetailHistory } from "@/features/tours/tour-workspace-finance-detail-history";
import { TourWorkspacePaymentActionsSection } from "@/features/tours/tour-workspace-payment-actions-section";
import { useTourWorkspacePaymentDetailData } from "@/features/tours/use-tour-workspace-payment-detail-data";
import type { ReceiptReviewResultBanner } from "@/finance/finance-receipt-review-content";
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

function kindStatusLabel(
  t: ReturnType<typeof useTranslations>,
  kind: TourFinanceGuestKind
): string {
  if (kind === "partial") {
    return t("statusPartial");
  }
  return t("statusUnpaid");
}

function kindBadgeClass(kind: TourFinanceGuestKind): string {
  if (kind === "partial") {
    return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
  return "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-300";
}

function kindAccentClass(kind: TourFinanceGuestKind): string {
  if (kind === "partial") {
    return "bg-sky-500/80";
  }
  return "bg-orange-500/80";
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
    if (panelBlocking || !loadSucceeded || pendingFocusId === null) {
      return;
    }
    const found = findTourFinanceGuestRow(inbox.guestRows, pendingFocusId);
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
    inbox.guestRows,
    isNarrowViewport,
    loadSucceeded,
    panelBlocking,
    pendingFocusId,
  ]);

  const visibleRows = useMemo(
    () => filterTourFinanceGuestRows(inbox.guestRows, listFilter, searchQuery),
    [inbox.guestRows, listFilter, searchQuery]
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

  const showGuestTools = !panelBlocking && shouldShowTourFinanceGuestTools(inbox);
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
  const detailAmountRows = useMemo(
    () => buildDetailAmountRows(selectedOutstanding, locale, t),
    [locale, selectedOutstanding, t]
  );
  const detailData = useTourWorkspacePaymentDetailData(
    selectedRow?.registrationId ?? null,
    receipts
  );
  const selectedPaymentAction = useMemo(
    () =>
      resolveSelectedWorkspacePaymentAction({
        lastPaymentAction,
        selectedRow,
        selectedReceiptId: null,
      }),
    [lastPaymentAction, selectedRow]
  );

  const refreshWorkspaceFinanceView = useCallback(() => {
    refresh();
    reloadWorkspaceChrome();
  }, [refresh, reloadWorkspaceChrome]);

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
      detailData.receipts.filter(
        (receipt) => receipt.status.trim().toLowerCase() === "pending"
      ),
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

  const awaitingRemainingMinor = useMemo(
    () => sumOutstandingRemainingMinor(inbox.awaitingPayment),
    [inbox.awaitingPayment]
  );
  const awaitingCurrency = inbox.awaitingPayment[0]?.invoice.currency ?? rollup?.currency ?? "IRR";
  const remainingTotalLabel =
    inbox.awaitingGuestCount > 0
      ? formatMinorAmount(awaitingRemainingMinor, awaitingCurrency, locale)
      : null;

  const awaitingLabel =
    inbox.awaitingGuestCount === 1
      ? t("guestsAwaitingPaymentOne")
      : t("guestsAwaitingPayment", {
          count: formatLocalizedNumber(inbox.awaitingGuestCount, locale),
        });

  const receiptsLabel =
    receipts.length === 1 && !receiptsHasMore
      ? t("receiptsNeedReviewOne")
      : t("receiptsNeedReview", {
          count: formatLocalizedNumber(receipts.length, locale) + (receiptsHasMore ? "+" : ""),
        });

  const renderPrimaryAction = (row: TourFinanceGuestRow) => {
    const rowSuffix = row.registrationId ?? row.key;
    if (row.kind === "partial") {
      return (
        <Button
          asChild
          size="sm"
          variant="outline"
          data-testid={`${TOUR_WORKSPACE_FINANCE_TEST_IDS.reviewPartial}-${rowSuffix}`}
        >
          <OperatorInternalLink
            href={buildTourFinanceHubHref(tourId, "payments", row.registrationId)}
          >
            {t("ctaReviewPartial")}
          </OperatorInternalLink>
        </Button>
      );
    }
    if (row.kind === "unpaid") {
      return (
        <Button
          asChild
          size="sm"
          variant="outline"
          data-testid={`${TOUR_WORKSPACE_FINANCE_TEST_IDS.followUpPayment}-${rowSuffix}`}
        >
          <OperatorInternalLink
            href={buildTourFinanceHubHref(tourId, "payments", row.registrationId)}
          >
            {t("ctaFollowUpPayment")}
          </OperatorInternalLink>
        </Button>
      );
    }
    return null;
  };

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

    const receiptReviewBanner =
      receiptReviewNotice !== null ? (
        <p
          className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
          role="status"
        >
          {receiptReviewNotice}
        </p>
      ) : null;

    const hasActiveSchedule = hasActiveTourWorkspacePaymentSchedule(detailData.schedule);
    const actionMode =
      detailData.detailState !== null
        ? resolveTourWorkspaceDetailActionMode(detailData.detailState.summaryStatus)
        : "active";

    return (
      <div className="space-y-4">
        {paymentActionBanner}
        {receiptReviewBanner}

        {detailData.loading ? (
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
          <TourWorkspaceFinanceDetailHero
            summaryStatus={detailData.detailState.summaryStatus}
            detailState={detailData.detailState}
            amountRows={detailAmountRows}
            rowKind={selectedRow.kind}
            locale={locale}
            formatDetailDate={formatDetailDate}
          />
        ) : null}

        {selectedRow.registrationId !== null ? (
          <TourWorkspacePaymentActionsSection
            tourId={tourId}
            registrationId={selectedRow.registrationId}
            canManage={canManage}
            actionMode={actionMode}
            summaryStatus={detailData.detailState?.summaryStatus ?? null}
            hasActiveSchedule={hasActiveSchedule}
            rowKind={selectedRow.kind}
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

        {detailData.detailState !== null ? (
          <TourWorkspaceFinanceDetailHistory
            detailState={detailData.detailState}
            payments={detailData.payments}
            receipts={detailData.receipts}
            locale={locale}
            formatDetailDate={formatDetailDate}
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
          {selectedRow.registrationId === null ? renderPrimaryAction(selectedRow) : null}
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
      description={selectedRow?.displayName ?? t("detailTitle")}
      testId={TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel}
    >
      {renderDetailBody()}
    </WorkspaceStickyDetailCard>
  );

  const listPanel = (
    <section className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold">{t("guestListTitle")}</h3>
      {visibleRows.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
          data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.empty}
        >
          {t("emptyFiltered")}
        </div>
      ) : (
        <ul className="space-y-2" data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.guestList}>
          {visibleRows.map((row) => {
            const amountLabel =
              row.amountMinor !== null && row.currency !== null
                ? formatMinorAmount(row.amountMinor, row.currency, locale)
                : null;
            const highlighted =
              row.registrationId !== null && row.registrationId === highlightedRegistrationId;
            const selected = row.key === selectedRowKey;
            return (
              <li
                key={row.key}
                data-finance-registration-id={row.registrationId ?? undefined}
                data-finance-kind={row.kind}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border px-3 py-3 text-start transition-colors",
                    "hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    highlighted && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                    selected
                      ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                      : "border-border bg-background"
                  )}
                  onClick={() => {
                    setSelectedRowKey(row.key);
                    if (isNarrowViewport) {
                      setMobileSheetOpen(true);
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-2 left-0 w-1 rounded-full opacity-0 transition-opacity",
                      kindAccentClass(row.kind),
                      selected && "opacity-100",
                      highlighted && !selected && "opacity-70"
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1 pl-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            selected && "text-foreground"
                          )}
                        >
                          {row.displayName}
                        </p>
                        <Badge variant="outline" className={kindBadgeClass(row.kind)}>
                          {kindStatusLabel(t, row.kind)}
                        </Badge>
                      </div>
                      {amountLabel !== null ? (
                        <div className="shrink-0 text-end">
                          <p
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              selected ? "text-foreground" : "text-foreground/90"
                            )}
                          >
                            {amountLabel}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t("guestListItemRemainingLabel")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="sr-only">
                    {row.displayName}
                    {amountLabel !== null ? ` ${amountLabel}` : ""}
                  </div>
                </button>
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
            className="space-y-1 rounded-md border bg-muted/20 px-3 py-2 text-sm"
            data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.statusStrip}
          >
            {inbox.awaitingGuestCount > 0 || inbox.partialOutstanding.length > 0 ? (
              <p className="font-medium">
                {inbox.awaitingGuestCount > 0 ? awaitingLabel : t("partialsNeedFollowUp")}
                {remainingTotalLabel !== null
                  ? ` · ${t("remainingTotal", { amount: remainingTotalLabel })}`
                  : null}
              </p>
            ) : null}
            {receipts.length > 0 ? (
              <p className={inbox.awaitingGuestCount > 0 ? "text-muted-foreground" : "font-medium"}>
                <OperatorInternalLink
                  href={buildTourFinanceHubHref(tourId, "receipts")}
                  className="underline-offset-2 hover:underline"
                >
                  {receiptsLabel}
                </OperatorInternalLink>
              </p>
            ) : null}
            {inbox.partialOutstanding.length > 0 ? (
              <p className="text-muted-foreground">
                {inbox.partialOutstanding.length === 1
                  ? t("partialsToReviewOne")
                  : t("partialsToReview", {
                      count: formatLocalizedNumber(inbox.partialOutstanding.length, locale),
                    })}
              </p>
            ) : null}
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
