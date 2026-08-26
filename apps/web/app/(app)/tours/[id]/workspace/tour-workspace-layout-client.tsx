"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorStatusBadge } from "@/admin/patterns/operator-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import type { BookingsOpsActionChrome } from "@/features/bookings/bookings-ops-action-chrome";
import { formatTourDeparture, formatTourSeats } from "@/features/tours/tour-list-formatters";
import {
  TourWorkspaceChromeProvider,
  useTourWorkspaceChrome,
} from "@/features/tours/tour-workspace-chrome-context";
import {
  buildTourWorkspaceBookingsHref,
  buildTourWorkspaceFinanceHref,
  buildTourWorkspaceOpsCountsQuery,
  resolveTourWorkspaceOpsCountsFromListPayloads,
  type TourWorkspaceOpsCounts,
} from "@/features/tours/tour-workspace-header-logic";
import {
  pickTourCollectionRollup,
  readPendingReceiptsKpi,
} from "@/features/tours/tour-workspace-finance-logic";
import {
  invalidateTourWorkspaceFinanceCache,
  loadTourWorkspaceCollectionsPage,
  loadTourWorkspacePendingReceiptsPage,
} from "@/features/tours/tour-workspace-finance-fetch-cache";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import {
  listTourWorkspaceSubnavTabs,
  resolveWorkspaceSubnavTab,
  WORKSPACE_TAB_QUERY_KEY,
} from "@/features/tours/tour-workspace-logic";
import { TourInternalLink } from "@/features/tours/tour-internal-link";
import {
  fetchTourDetailCached,
  readCachedTourDetail,
} from "@/features/tours/tour-route-cache";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

import { TourStatusBadge } from "../../tour-status-badge";

import { TourWorkspaceTabPanels } from "./tour-workspace-tab-panels";

type TourWorkspaceLayoutClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly opsActions: BookingsOpsActionChrome;
  /** TW-C-05 — resolved on RSC layout via ensureFinanceNavSupported (not client plugin load). */
  readonly includeFinance: boolean;
};

type WorkspaceMoneyKpis = {
  readonly expectedLabel: string | null;
  readonly collectedLabel: string | null;
  readonly balanceDueLabel: string | null;
  readonly pendingReceiptsLabel: string;
};

function TourWorkspaceLayoutInner({
  session,
  tourId,
  opsActions,
  includeFinance,
}: TourWorkspaceLayoutClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace");
  const tFormat = useTranslations("tours.format");
  const tErrors = useTranslations("tours.workspace.errors");
  const tNav = useTranslations("tours.nav");
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const tabParam = searchParams.get(WORKSPACE_TAB_QUERY_KEY);
  const activeTab = resolveWorkspaceSubnavTab(pathname, tourId, tabParam);
  const { reloadNonce, navigateWorkspaceTab } = useTourWorkspaceChrome();
  const canManage = isAdminOrOwnerRole(session.role);
  const moneyReloadSeenRef = useRef(reloadNonce);
  const [detail, setDetail] = useState<OperatorTourDetailResponse | null>(() =>
    readCachedTourDetail(tourId)
  );
  const [opsCounts, setOpsCounts] = useState<TourWorkspaceOpsCounts | null>(null);
  const [opsCountsError, setOpsCountsError] = useState<string | null>(null);
  const [moneyKpis, setMoneyKpis] = useState<WorkspaceMoneyKpis | null>(null);
  const [loading, setLoading] = useState(() => readCachedTourDetail(tourId) === null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchTourDetailCached(tourId, { force: reloadNonce > 0 })
      .then((payload) => {
        if (!cancelled) {
          setDetail(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOUR_WORKSPACE_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tourId, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadOps = async () => {
      try {
        const [pendingRes, waitlistedRes, approvedRes] = await Promise.all([
          fetch(`/api/bookings?${buildTourWorkspaceOpsCountsQuery(tourId, "pending")}`, {
            cache: "no-store",
          }),
          fetch(`/api/bookings?${buildTourWorkspaceOpsCountsQuery(tourId, "waitlisted")}`, {
            cache: "no-store",
          }),
          fetch(`/api/bookings?${buildTourWorkspaceOpsCountsQuery(tourId, "approved")}`, {
            cache: "no-store",
          }),
        ]);
        if (!pendingRes.ok || !waitlistedRes.ok || !approvedRes.ok) {
          throw new Error("TOUR_WORKSPACE_OPS_COUNTS_FAILED");
        }
        const resolved = resolveTourWorkspaceOpsCountsFromListPayloads({
          pendingPayload: await pendingRes.json(),
          waitlistedPayload: await waitlistedRes.json(),
          approvedPayload: await approvedRes.json(),
        });
        if (!cancelled) {
          if (!resolved.ok) {
            setOpsCounts(null);
            setOpsCountsError(resolved.errorCode);
            return;
          }
          setOpsCounts(resolved.counts);
          setOpsCountsError(null);
        }
      } catch {
        if (!cancelled) {
          setOpsCounts(null);
          setOpsCountsError("TOUR_WORKSPACE_OPS_COUNTS_FAILED");
        }
      }
    };
    void loadOps();
    return () => {
      cancelled = true;
    };
  }, [tourId, reloadNonce]);

  useEffect(() => {
    if (!includeFinance) {
      setMoneyKpis(null);
      return;
    }
    let cancelled = false;
    const loadMoney = async () => {
      try {
        const chromeReloaded = moneyReloadSeenRef.current !== reloadNonce;
        moneyReloadSeenRef.current = reloadNonce;
        if (chromeReloaded) {
          invalidateTourWorkspaceFinanceCache(tourId);
        }
        const [toursPage, receiptsPage] = await Promise.all([
          loadTourWorkspaceCollectionsPage(tourId, { force: chromeReloaded }),
          loadTourWorkspacePendingReceiptsPage(tourId, { force: chromeReloaded }),
        ]);
        const rollup = pickTourCollectionRollup(toursPage.items, tourId);
        const receiptsKpi = readPendingReceiptsKpi({
          itemCount: receiptsPage.items.length,
          hasMore: receiptsPage.hasMore,
        });
        if (!cancelled) {
          setMoneyKpis({
            expectedLabel:
              rollup !== null
                ? formatMinorAmount(rollup.invoiceTotalMinor, rollup.currency, locale)
                : null,
            collectedLabel:
              rollup !== null
                ? formatMinorAmount(rollup.collectedMinor, rollup.currency, locale)
                : null,
            balanceDueLabel:
              rollup !== null
                ? formatMinorAmount(rollup.remainingMinor, rollup.currency, locale)
                : null,
            pendingReceiptsLabel: receiptsKpi.label,
          });
        }
      } catch {
        if (!cancelled) {
          setMoneyKpis({
            expectedLabel: null,
            collectedLabel: null,
            balanceDueLabel: null,
            pendingReceiptsLabel: "—",
          });
        }
      }
    };
    void loadMoney();
    return () => {
      cancelled = true;
    };
  }, [includeFinance, locale, tourId, reloadNonce]);

  const subnavTabs = useMemo(
    () => listTourWorkspaceSubnavTabs({ includeFinance }),
    [includeFinance]
  );

  const financeEnabled = includeFinance;
  const visibleActiveTab =
    activeTab === "finance" && !financeEnabled ? "registrations" : activeTab;

  useEffect(() => {
    if (activeTab === "finance" && !financeEnabled && navigateWorkspaceTab !== null) {
      navigateWorkspaceTab("registrations");
    }
  }, [activeTab, financeEnabled, navigateWorkspaceTab]);

  const tabBadgeCounts = useMemo(() => {
    const map: Partial<Record<(typeof subnavTabs)[number]["tab"], number>> = {};
    if (opsCounts !== null) {
      map.registrations = opsCounts.pending;
      map.waitlist = opsCounts.waitlisted;
      map.transport = opsCounts.approved;
    }
    if (moneyKpis !== null) {
      const parsed = Number.parseInt(moneyKpis.pendingReceiptsLabel.replace(/\D/g, ""), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        map.finance = parsed;
      }
    }
    return map;
  }, [moneyKpis, opsCounts, subnavTabs]);

  const localizedError = resolveTourErrorMessage(tErrors, error);
  const opsErrorLocalized = resolveTourErrorMessage(tErrors, opsCountsError);
  const departureLabel =
    detail !== null ? formatTourDeparture(detail.projection.departureAt, locale) : null;
  const seatsLabel =
    detail !== null
      ? formatTourSeats(detail.projection, {
          withCapacity: (accepted, capacity) =>
            tFormat("seatsWithCapacity", { accepted, capacity }),
          open: (accepted) => tFormat("seatsOpen", { accepted }),
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-none space-y-6" data-testid={TOUR_WORKSPACE_TEST_IDS.page}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <TourInternalLink href="/tours">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {tNav("tours")}
          </TourInternalLink>
        </Button>
        <Button asChild variant="outline" size="sm">
          <TourInternalLink href={`/tours/${encodeURIComponent(tourId)}/edit`}>{tNav("editTour")}</TourInternalLink>
        </Button>
        {canManage ? (
          <Button asChild variant="default" size="sm">
            <TourInternalLink href={`/tours/${encodeURIComponent(tourId)}/register`}>
              {tNav("registerGuest")}
            </TourInternalLink>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" data-testid={TOUR_WORKSPACE_TEST_IDS.openBookings}>
          <TourInternalLink href={buildTourWorkspaceBookingsHref(tourId)}>{t("openCommandCenter")}</TourInternalLink>
        </Button>
        {includeFinance ? (
          <Button asChild variant="outline" size="sm" data-testid={TOUR_WORKSPACE_TEST_IDS.openFinance}>
            <TourInternalLink href={buildTourWorkspaceFinanceHref(tourId)}>{t("openFinance")}</TourInternalLink>
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <p
          className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid={TOUR_WORKSPACE_TEST_IDS.roleBanner}
        >
          {t("readOnlyBanner")}
        </p>
      ) : null}

      {loading ? <Skeleton className="h-24 w-full rounded-xl" /> : null}
      {localizedError !== null ? <p className="text-sm text-destructive">{localizedError}</p> : null}

      {!loading && detail !== null ? (
        <Card
          data-operator-surface="card"
          className="shadow-sm"
          data-testid={TOUR_WORKSPACE_TEST_IDS.header}
        >
          <CardHeader className="space-y-2">
            <TourStatusBadge status={detail.projection.uiStatus} />
            <CardTitle className="text-2xl">{detail.projection.title}</CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {departureLabel !== null ? (
                <span>
                  {t("header.departure")}: {departureLabel}
                </span>
              ) : null}
              {seatsLabel !== null && seatsLabel.length > 0 ? (
                <span>
                  {t("header.capacity")}: {seatsLabel}
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {opsErrorLocalized !== null ? (
              <p className="text-sm text-destructive" data-testid={TOUR_WORKSPACE_TEST_IDS.opsCountsError}>
                {opsErrorLocalized}
              </p>
            ) : null}
            {opsCounts !== null ? (
              <div className="flex flex-wrap gap-2" data-testid={TOUR_WORKSPACE_TEST_IDS.headerKpis}>
                {(
                  [
                    ["pending", t("header.pending")],
                    ["waitlisted", t("header.waitlisted")],
                    ["approved", t("header.approved")],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                    onClick={() =>
                      navigateWorkspaceTab?.(
                        key === "waitlisted"
                          ? "waitlist"
                          : key === "approved"
                            ? "transport"
                            : "registrations"
                      )
                    }
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold">
                      {formatLocalizedNumber(opsCounts[key], locale)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {moneyKpis !== null ? (
              <div className="flex flex-wrap gap-2" data-testid={TOUR_WORKSPACE_TEST_IDS.headerMoneyKpis}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => navigateWorkspaceTab?.("finance")}
                >
                  <span className="text-xs text-muted-foreground">{t("header.expected")}</span>
                  <span className="text-sm font-semibold">{moneyKpis.expectedLabel ?? "—"}</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => navigateWorkspaceTab?.("finance")}
                >
                  <span className="text-xs text-muted-foreground">{t("header.collected")}</span>
                  <span className="text-sm font-semibold">{moneyKpis.collectedLabel ?? "—"}</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => navigateWorkspaceTab?.("finance")}
                >
                  <span className="text-xs text-muted-foreground">{t("header.balanceDue")}</span>
                  <span className="text-sm font-semibold">{moneyKpis.balanceDueLabel ?? "—"}</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => navigateWorkspaceTab?.("finance")}
                >
                  <span className="text-xs text-muted-foreground">{t("header.pendingReceipts")}</span>
                  <span className="text-sm font-semibold">{moneyKpis.pendingReceiptsLabel}</span>
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <nav
        className="flex flex-wrap gap-2 border-b pb-2"
        aria-label={t("subnavAria")}
        data-testid={TOUR_WORKSPACE_TEST_IDS.subnav}
      >
        {subnavTabs.map(({ tab, testId }) => {
          const isActive = visibleActiveTab === tab;
          const badge = tabBadgeCounts[tab];
          return (
            <button
              key={tab}
              type="button"
              data-testid={testId}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              onClick={() => navigateWorkspaceTab?.(tab)}
            >
              {t(`tabs.${tab}`)}
              {badge !== undefined && badge > 0 ? (
                <OperatorStatusBadge
                  variant={isActive ? "secondary" : "outline"}
                  className={isActive ? "border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground" : undefined}
                  data-testid={TOUR_WORKSPACE_TEST_IDS.tabBadge}
                >
                  {formatLocalizedNumber(badge, locale)}
                </OperatorStatusBadge>
              ) : null}
            </button>
          );
        })}
      </nav>

      <TourWorkspaceTabPanels
        activeTab={visibleActiveTab}
        session={session}
        tourId={tourId}
        opsActions={opsActions}
        includeFinance={financeEnabled}
        detail={detail}
      />
    </div>
  );
}

export function TourWorkspaceLayoutClient(props: TourWorkspaceLayoutClientProps) {
  return (
    <TourWorkspaceChromeProvider tourId={props.tourId}>
      <TourWorkspaceLayoutInner {...props} />
    </TourWorkspaceChromeProvider>
  );
}
