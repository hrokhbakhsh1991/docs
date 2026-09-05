"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAppPathname, useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { buildTourWorkspaceOpsCountsQuery, resolveTourWorkspaceOpsCountsFromListPayloads, type TourWorkspaceOpsCounts } from "@/features/tours/tour-workspace-header-logic";
import { resolveTourWorkspaceLifecyclePhase } from "@/features/tours/tour-workspace-lifecycle-phase";
import {
  listTourWorkspaceSubnavTabs,
  resolveWorkspaceSubnavTab,
  WORKSPACE_TAB_QUERY_KEY,
} from "@/features/tours/tour-workspace-logic";
import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { fetchTourDetailCached, readCachedTourDetail } from "@/features/tours/tour-route-cache";
import { TOUR_WORKSPACE_TEST_IDS } from "@/features/tours/tour-workspace-types";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";

import { TourStatusBadge } from "../../tour-status-badge";

import type { InTourOpsPanels } from "@/features/tours/in-tour-ops-enablement";

import { TourWorkspaceTabPanels } from "./tour-workspace-tab-panels";

type TourWorkspaceLayoutClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly opsActions: BookingsOpsActionChrome;
  /** TW-C-05 — resolved on RSC layout via ensureFinanceNavSupported (not client plugin load). */
  readonly includeFinance: boolean;
  /** ITO-001 — operations tab when workspace exposes inTourOps capability. */
  readonly includeOperations: boolean;
  readonly inTourOpsPanels: InTourOpsPanels;
};

function TourWorkspaceLayoutInner({
  session,
  tourId,
  opsActions,
  includeFinance,
  includeOperations,
  inTourOpsPanels,
}: TourWorkspaceLayoutClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.workspace");
  const tFormat = useTranslations("tours.format");
  const tErrors = useTranslations("tours.workspace.errors");
  const tNav = useTranslations("tours.nav");
  const pathname = useAppPathname();
  const searchParams = useAppSearchParams();
  const tabParam = searchParams.get(WORKSPACE_TAB_QUERY_KEY);
  const activeTab = resolveWorkspaceSubnavTab(pathname, tourId, tabParam);
  const { reloadNonce, navigateWorkspaceTab } = useTourWorkspaceChrome();
  const canManage = isAdminOrOwnerRole(session.role);
  const [detail, setDetail] = useState<OperatorTourDetailResponse | null>(() =>
    readCachedTourDetail(tourId)
  );
  const [opsCounts, setOpsCounts] = useState<TourWorkspaceOpsCounts | null>(null);
  const [opsCountsError, setOpsCountsError] = useState<string | null>(null);
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
          setError(
            fetchError instanceof Error ? fetchError.message : "TOUR_WORKSPACE_FETCH_FAILED"
          );
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

  const subnavTabs = useMemo(
    () => listTourWorkspaceSubnavTabs({ includeFinance, includeOperations }),
    [includeFinance, includeOperations],
  );

  const financeEnabled = includeFinance;
  const operationsEnabled = includeOperations;
  const visibleActiveTab =
    activeTab === "finance" && !financeEnabled
      ? "registrations"
      : activeTab === "operations" && !operationsEnabled
        ? "registrations"
        : activeTab;

  useEffect(() => {
    if (activeTab === "finance" && !financeEnabled && navigateWorkspaceTab !== null) {
      navigateWorkspaceTab("registrations");
    }
    if (activeTab === "operations" && !operationsEnabled && navigateWorkspaceTab !== null) {
      navigateWorkspaceTab("registrations");
    }
  }, [activeTab, financeEnabled, operationsEnabled, navigateWorkspaceTab]);

  const tabBadgeCounts = useMemo(() => {
    const map: Partial<Record<(typeof subnavTabs)[number]["tab"], number>> = {};
    if (opsCounts !== null) {
      map.registrations = opsCounts.pending;
      map.waitlist = opsCounts.waitlisted;
    }
    return map;
  }, [opsCounts]);

  const pendingCount = opsCounts?.pending ?? 0;
  const showPendingPrimary = canManage && pendingCount > 0;
  const lifecyclePhase =
    detail !== null ? resolveTourWorkspaceLifecyclePhase(detail.projection) : null;

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
    <div className="mx-auto w-full max-w-none space-y-4" data-testid={TOUR_WORKSPACE_TEST_IDS.page}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <TourInternalLink href="/tours">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {tNav("tours")}
          </TourInternalLink>
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                aria-label={t("secondaryActions")}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t("secondaryActions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <TourInternalLink href={`/tours/${encodeURIComponent(tourId)}/edit`}>
                  {tNav("editTour")}
                </TourInternalLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showPendingPrimary ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="shrink-0"
              data-testid={TOUR_WORKSPACE_TEST_IDS.reviewPendingPrimary}
              onClick={() => navigateWorkspaceTab?.("registrations")}
            >
              {t("reviewPending", { count: pendingCount })}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              asChild
              variant={showPendingPrimary ? "outline" : "default"}
              size="sm"
              className="shrink-0"
            >
              <TourInternalLink href={`/tours/${encodeURIComponent(tourId)}/register`}>
                {tNav("registerGuest")}
              </TourInternalLink>
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? <Skeleton className="h-20 w-full rounded-xl" /> : null}
      {localizedError !== null ? (
        <p className="text-sm text-destructive">{localizedError}</p>
      ) : null}

      {!loading && detail !== null ? (
        <Card
          data-operator-surface="card"
          className="shadow-sm"
          data-testid={TOUR_WORKSPACE_TEST_IDS.header}
        >
          <CardHeader className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <TourStatusBadge status={detail.projection.uiStatus} />
                  {lifecyclePhase !== null ? (
                    <OperatorStatusBadge
                      variant="secondary"
                      data-testid={TOUR_WORKSPACE_TEST_IDS.lifecyclePhase}
                    >
                      {t(`lifecyclePhase.${lifecyclePhase}`)}
                    </OperatorStatusBadge>
                  ) : null}
                  <span className="text-sm font-medium text-muted-foreground">{t("title")}</span>
                </div>
                <CardTitle className="text-xl leading-tight sm:text-2xl">
                  {detail.projection.title}
                </CardTitle>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-end sm:text-end">
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
            </div>
            {opsErrorLocalized !== null ? (
              <p
                className="text-sm text-destructive"
                data-testid={TOUR_WORKSPACE_TEST_IDS.opsCountsError}
              >
                {opsErrorLocalized}
              </p>
            ) : null}
          </CardHeader>
        </Card>
      ) : null}

      {!canManage ? (
        <p
          className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          data-testid={TOUR_WORKSPACE_TEST_IDS.roleBanner}
        >
          {t("readOnlyBanner")}
        </p>
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
                  className={
                    isActive
                      ? "border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground"
                      : undefined
                  }
                  data-testid={TOUR_WORKSPACE_TEST_IDS.tabBadge}
                >
                  {formatLocalizedNumber(badge, locale)}
                </OperatorStatusBadge>
              ) : null}
            </button>
          );
        })}
      </nav>

      <p className="text-xs text-muted-foreground" data-testid={TOUR_WORKSPACE_TEST_IDS.tabHint}>
        {t(`tabsHint.${visibleActiveTab}`)}
      </p>

      <TourWorkspaceTabPanels
        activeTab={visibleActiveTab}
        session={session}
        tourId={tourId}
        opsActions={opsActions}
        includeFinance={financeEnabled}
        inTourOpsPanels={inTourOpsPanels}
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
