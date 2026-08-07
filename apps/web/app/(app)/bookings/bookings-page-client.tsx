"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { OperatorEmptyState } from "@/admin/patterns/operator-empty-state";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookingInboxRow } from "@/features/bookings/booking-inbox-row";
import { BookingInspectionDetails } from "@/features/bookings/booking-inspection-details";
import {
  BOOKINGS_INLINE_APPROVE_ENABLED,
  BOOKINGS_INLINE_APPROVE_ARM_MS,
  BOOKINGS_MOBILE_INSPECTION_MAX_WIDTH_MQ,
  bookingsAdvancedFiltersDirty,
  bookingsCommandCenterHasActiveFilters,
  buildBookingsApiQuery,
  buildBookingsCommandCenterHref,
  buildRejectBookingRequestBody,
  filterBulkApprovableIds,
  findSelectedBooking,
  isBookingCancellable,
  isBookingWaitlistable,
  isBulkApprovable,
  isLeaderReviewAlias,
  isBookingsUpcomingFacetActive,
  buildBookingsSummaryApiQuery,
  listBulkApprovableIds,
  mergeBookingsListPages,
  parseBookingsCommandCenterQuery,
  parseBulkApproveBookingsResponse,
  readBookingIdFromCommandCenterParams,
  applyDepartureWindow,
  BOOKINGS_UPCOMING_FACET_DAYS,
  resolveBookingsKpiQueryPatch,
  resolveInboxSelectionAfterKey,
  resolveInlineApproveClick,
  serializeBookingsCommandCenterQuery,
  sortBookingListItems,
  shouldShowInlineApprove,
  shouldRunBookingsQueueSoftRefresh,
  BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS,
  toggleTourChipFilter,
  type BookingsKpiFilterId,
} from "@/features/bookings/bookings-command-center-logic";
import { BookingsFilterControls } from "@/features/bookings/bookings-filter-controls";
import { BookingsDisplayMenu } from "@/features/bookings/bookings-display-menu";
import { BookingsKpiCard } from "@/features/bookings/bookings-kpi-card";
import {
  BookingsBulkConfirmDialog,
  BookingsCancelConfirmDialog,
  BookingsRejectDialog,
} from "@/features/bookings/bookings-ops-dialogs";
import { BookingsTourChipBar } from "@/features/bookings/bookings-tour-chip-bar";
import { BookingsUpcomingFacetButton } from "@/features/bookings/bookings-upcoming-facet-button";
import { BookingsOpsPresetsBar } from "@/features/bookings/bookings-ops-presets-bar";
import {
  groupBookingsByDepartureDay,
  groupBookingsByTour,
} from "@/features/bookings/bookings-ops-path-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  isAdminOrOwnerRole,
  resolveBookingsViewForRole,
  type BookingListItem,
  type BookingsCommandCenterQuery,
  type BookingsListResponse,
  type BookingsSummaryResponse,
} from "@/features/bookings/bookings-command-center-types";

import type { AppLocale } from "@/i18n/routing";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { resolveBookingsPageBodyState } from "./bookings-command-center-gate";
import type { BookingsServerPrefetch } from "@/features/bookings/fetch-bookings-list.server";
import {
  DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
  type BookingsOpsActionChrome,
} from "@/features/bookings/bookings-ops-action-chrome";

type BookingsPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly leaderAlias?: boolean;
  readonly initialPrefetch?: BookingsServerPrefetch | null;
  /** UX-BKG-46 — defaults when omitted (stories / legacy callers). */
  readonly opsActions?: BookingsOpsActionChrome;
};

export function BookingsPageClient({
  session,
  leaderAlias = false,
  initialPrefetch = null,
  opsActions = DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
}: BookingsPageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("bookings");
  const tErrors = useTranslations("bookings.errors");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const bulkApproveMaxBatch = opsActions.bulkApproveMaxBatch;
  const rejectRequiresReason = opsActions.rejectRequiresReason;
  const parsedQuery = useMemo(
    () => parseBookingsCommandCenterQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const canManageOps = isAdminOrOwnerRole(session.role);
  const query: BookingsCommandCenterQuery = useMemo(
    () => ({
      ...parsedQuery,
      view: resolveBookingsViewForRole(session.role, parsedQuery.view),
      ...(leaderAlias ? { scope: "leader", view: "ops" } : {}),
    }),
    [leaderAlias, parsedQuery, session.role]
  );

  const [searchInput, setSearchInput] = useState(query.search);
  const [listData, setListData] = useState<BookingsListResponse | null>(
    initialPrefetch?.list ?? null
  );
  const [summary, setSummary] = useState<BookingsSummaryResponse | null>(
    initialPrefetch?.summary ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialPrefetch === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialPrefetch !== null);
  const lastFetchSucceededAtRef = useRef<number | null>(
    initialPrefetch !== null ? Date.now() : null
  );
  const listDataRef = useRef(listData);
  listDataRef.current = listData;
  const queryRef = useRef(query);
  queryRef.current = query;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
      new URLSearchParams(searchParams.toString())
    );
    if (
      bookingIdFromUrl.length > 0 &&
      initialPrefetch?.list.items.some((item) => item.id === bookingIdFromUrl)
    ) {
      return bookingIdFromUrl;
    }
    return initialPrefetch?.list.items[0]?.id ?? null;
  });
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [armedInlineApproveId, setArmedInlineApproveId] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [inspectionBooking, setInspectionBooking] = useState<BookingListItem | null>(null);
  const inlineApproveArmTimeoutRef = useRef<number | null>(null);

  const replaceQuery = (next: BookingsCommandCenterQuery) => {
    const serialized = serializeBookingsCommandCenterQuery(next);
    router.replace(serialized.length > 0 ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    });
  };

  const selectBooking = (bookingId: string) => {
    clearInlineApproveArm();
    setSelectedId(bookingId);
    router.replace(buildBookingsCommandCenterHref(pathname, query, bookingId), {
      scroll: false,
    });
  };

  const clearSelection = () => {
    setSelectedId(null);
    setMobileSheetOpen(false);
    router.replace(buildBookingsCommandCenterHref(pathname, query, null), {
      scroll: false,
    });
  };

  useEffect(() => {
    return () => {
      if (inlineApproveArmTimeoutRef.current !== null) {
        window.clearTimeout(inlineApproveArmTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(BOOKINGS_MOBILE_INSPECTION_MAX_WIDTH_MQ);
    const sync = () => setIsNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isNarrowViewport) {
      setMobileSheetOpen(false);
      return;
    }
    setMobileSheetOpen(selectedId !== null);
  }, [isNarrowViewport, selectedId]);

  useEffect(() => {
    setSearchInput(query.search);
  }, [query.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === queryRef.current.search) {
        return;
      }
      replaceQuery({ ...queryRef.current, search: searchInput });
    }, 350);
    return () => window.clearTimeout(handle);
    // Debounce only on searchInput; latest filters via queryRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional debounce scope
  }, [searchInput]);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    if (listDataRef.current === null) {
      setLoading(true);
    }
    setError(null);

    const apiQuery = buildBookingsApiQuery(query);
    const listPromise = fetch(`/api/bookings?${apiQuery}`, { cache: "no-store" });
    const summaryQs = buildBookingsSummaryApiQuery(query);
    const summaryPromise = canManageOps
      ? fetch(
          summaryQs.length > 0
            ? `/api/bookings/summary?${summaryQs}`
            : "/api/bookings/summary",
          { cache: "no-store" }
        )
      : Promise.resolve(null);

    void Promise.all([listPromise, summaryPromise])
      .then(async ([listRes, summaryRes]) => {
        if (listRes.status === 403) {
          throw new Error("BOOKINGS_OPS_FORBIDDEN");
        }
        if (!listRes.ok) {
          throw new Error(`BOOKINGS_LIST_HTTP_${listRes.status}`);
        }
        const listJson = (await listRes.json()) as BookingsListResponse;
        let summaryJson: BookingsSummaryResponse | null = null;
        if (summaryRes !== null && summaryRes.ok) {
          summaryJson = (await summaryRes.json()) as BookingsSummaryResponse;
        }
        if (!cancelled) {
          lastFetchSucceededAtRef.current = Date.now();
          setListData(mergeBookingsListPages(null, listJson, "replace"));
          setSummary(summaryJson);
          const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
            new URLSearchParams(searchParams.toString())
          );
          setSelectedId((current) => {
            if (
              bookingIdFromUrl.length > 0 &&
              listJson.items.some((item) => item.id === bookingIdFromUrl)
            ) {
              return bookingIdFromUrl;
            }
            if (current !== null && listJson.items.some((item) => item.id === current)) {
              return current;
            }
            return listJson.items[0]?.id ?? null;
          });
          setBulkSelectedIds((current) =>
            current.filter((id) => listJson.items.some((item) => item.id === id))
          );
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          const message =
            fetchError instanceof Error ? fetchError.message : "BOOKINGS_FETCH_FAILED";
          if (listDataRef.current === null) {
            setError(message);
          } else {
            setActionError(message);
          }
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
    // searchParams read for bookingId hydrate only; list refetch keys are query + fetchNonce
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookingId must not refetch list
  }, [canManageOps, fetchNonce, query]);

  const bodyState = resolveBookingsPageBodyState({
    canManageOps,
    view: query.view,
    loading: loading && listData === null,
    error,
    itemsLength: listData?.items.length ?? 0,
    hasActiveFilters: bookingsCommandCenterHasActiveFilters(query),
    upcomingFacetActive: isBookingsUpcomingFacetActive(query),
  });

  const displayItems = useMemo(
    () => sortBookingListItems(listData?.items ?? [], query.sort),
    [listData?.items, query.sort]
  );

  const selectedBooking = findSelectedBooking(displayItems, selectedId);

  useEffect(() => {
    if (selectedId === null || selectedBooking === null) {
      return;
    }
    if (selectedBooking.id !== selectedId) {
      setSelectedId(selectedBooking.id);
    }
  }, [selectedBooking, selectedId]);

  /** UX-BKG-50 amend — load detail intake for inspection/sheet (list omits registrationIntake). */
  useEffect(() => {
    if (selectedId === null) {
      setInspectionBooking(null);
      return;
    }
    const listRow = findSelectedBooking(displayItems, selectedId);
    if (listRow !== null) {
      setInspectionBooking(listRow);
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(selectedId)}`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          return;
        }
        const detail = (await response.json()) as BookingListItem;
        if (!cancelled && detail.id === selectedId) {
          setInspectionBooking(detail);
        }
      } catch {
        /* keep list-row fallback without intake */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, displayItems, fetchNonce]);

  const inspectionTarget = inspectionBooking ?? selectedBooking;

  const applyKpiFilter = (kpi: BookingsKpiFilterId) => {
    if (kpi === "departures7d") {
      replaceQuery(
        applyDepartureWindow(query, {
          days: Number(BOOKINGS_UPCOMING_FACET_DAYS),
          membership: "portfolio",
        })
      );
      return;
    }
    replaceQuery({
      ...query,
      ...resolveBookingsKpiQueryPatch(kpi),
    });
  };

  const copyBookingId = async (bookingId: string) => {
    try {
      await navigator.clipboard.writeText(bookingId);
      setIdCopied(true);
      window.setTimeout(() => setIdCopied(false), 1500);
    } catch {
      setActionError("BOOKINGS_ACTION_FAILED");
    }
  };

  const refreshData = () => {
    setBulkSelectedIds([]);
    setActionError(null);
    setFetchNonce((value) => value + 1);
  };

  /** UX-BKG-49 — visibility soft refresh; preserves bulk selection. */
  const softRefreshData = () => {
    lastFetchSucceededAtRef.current = Date.now();
    setFetchNonce((value) => value + 1);
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        !shouldRunBookingsQueueSoftRefresh({
          visibilityState: document.visibilityState,
          nowMs: Date.now(),
          lastFetchSucceededAtMs: lastFetchSucceededAtRef.current,
          cooldownMs: BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS,
          actionBusy,
          loadingMore,
          dialogOpen: rejectDialogOpen || bulkConfirmOpen || cancelDialogOpen,
        })
      ) {
        return;
      }
      softRefreshData();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [actionBusy, bulkConfirmOpen, cancelDialogOpen, loadingMore, rejectDialogOpen]);

  const loadMore = async () => {
    const cursor = listData?.nextCursor?.trim() ?? "";
    if (cursor.length === 0 || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setActionError(null);
    try {
      const apiQuery = buildBookingsApiQuery(query, { cursor });
      const response = await fetch(`/api/bookings?${apiQuery}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`BOOKINGS_LIST_HTTP_${response.status}`);
      }
      const page = (await response.json()) as BookingsListResponse;
      setListData((current) => mergeBookingsListPages(current, page, "append"));
    } catch (loadError: unknown) {
      setActionError(loadError instanceof Error ? loadError.message : "BOOKINGS_FETCH_FAILED");
    } finally {
      setLoadingMore(false);
    }
  };

  const bulkApprovableIds = useMemo(
    () =>
      filterBulkApprovableIds(
        listData?.items ?? [],
        bulkSelectedIds,
        bulkApproveMaxBatch
      ),
    [bulkApproveMaxBatch, bulkSelectedIds, listData?.items]
  );
  const pageApprovableIds = useMemo(
    () => listBulkApprovableIds(listData?.items ?? [], bulkApproveMaxBatch),
    [bulkApproveMaxBatch, listData?.items]
  );
  const allPageApprovableSelected =
    pageApprovableIds.length > 0 &&
    pageApprovableIds.every((id) => bulkSelectedIds.includes(id));

  const runBulkApprove = async () => {
    if (bulkApprovableIds.length === 0) {
      return;
    }
    setBulkConfirmOpen(false);
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await fetch("/api/bookings/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkApprovableIds }),
      });
      if (!response.ok) {
        throw new Error(`BOOKINGS_BULK_APPROVE_HTTP_${response.status}`);
      }
      const result = parseBulkApproveBookingsResponse(await response.json());
      if (result.skippedIds.length > 0) {
        setActionNotice(
          t("bulkPartial", {
            approved: result.approvedIds.length,
            skipped: result.skippedIds.length,
          })
        );
      }
      refreshData();
    } catch (bulkError: unknown) {
      setActionError(
        bulkError instanceof Error ? bulkError.message : "BOOKINGS_BULK_APPROVE_FAILED"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const openRejectDialog = (bookingId: string) => {
    setRejectTargetId(bookingId);
    setRejectReasonDraft("");
    setRejectDialogOpen(true);
  };

  const clearInlineApproveArm = () => {
    if (inlineApproveArmTimeoutRef.current !== null) {
      window.clearTimeout(inlineApproveArmTimeoutRef.current);
      inlineApproveArmTimeoutRef.current = null;
    }
    setArmedInlineApproveId(null);
  };

  const handleInlineApproveClick = (bookingId: string) => {
    const result = resolveInlineApproveClick({
      armedBookingId: armedInlineApproveId,
      clickedBookingId: bookingId,
    });
    if (result.kind === "confirm") {
      clearInlineApproveArm();
      void runBookingAction("approve", bookingId);
      return;
    }
    setArmedInlineApproveId(result.armedBookingId);
    if (inlineApproveArmTimeoutRef.current !== null) {
      window.clearTimeout(inlineApproveArmTimeoutRef.current);
    }
    inlineApproveArmTimeoutRef.current = window.setTimeout(() => {
      setArmedInlineApproveId(null);
      inlineApproveArmTimeoutRef.current = null;
    }, BOOKINGS_INLINE_APPROVE_ARM_MS);
  };

  const openCancelDialog = (bookingId: string) => {
    setCancelTargetId(bookingId);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (cancelTargetId === null) {
      return;
    }
    const bookingId = cancelTargetId;
    setCancelDialogOpen(false);
    setCancelTargetId(null);
    await runBookingAction("cancel", bookingId);
  };

  const confirmReject = async () => {
    if (rejectTargetId === null) {
      return;
    }
    const bookingId = rejectTargetId;
    setRejectDialogOpen(false);
    setRejectTargetId(null);
    await runBookingAction("reject", bookingId, rejectReasonDraft);
    setRejectReasonDraft("");
  };

  const toggleBulkSelection = (bookingId: string) => {
    setBulkSelectedIds((current) =>
      current.includes(bookingId)
        ? current.filter((id) => id !== bookingId)
        : [...current, bookingId]
    );
  };

  const toggleSelectAllApprovable = () => {
    if (allPageApprovableSelected) {
      setBulkSelectedIds([]);
      return;
    }
    setBulkSelectedIds(pageApprovableIds);
  };

  const runBookingAction = async (
    action: "approve" | "reject" | "waitlist" | "cancel",
    bookingId: string,
    rejectReason = ""
  ) => {
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? buildRejectBookingRequestBody(rejectReason) : undefined,
      });
      if (!response.ok) {
        throw new Error(`BOOKINGS_${action.toUpperCase()}_HTTP_${response.status}`);
      }
      refreshData();
    } catch (actionErr: unknown) {
      setActionError(actionErr instanceof Error ? actionErr.message : "BOOKINGS_ACTION_FAILED");
    } finally {
      setActionBusy(false);
    }
  };

  const showLeaderBanner = leaderAlias || isLeaderReviewAlias(query.scope);
  const canActOnSelected =
    canManageOps &&
    selectedBooking !== null &&
    (selectedBooking.status === "pending" || selectedBooking.status === "waitlisted");
  const canWaitlistSelected =
    canManageOps && selectedBooking !== null && isBookingWaitlistable(selectedBooking);
  const canCancelSelected =
    canManageOps && selectedBooking !== null && isBookingCancellable(selectedBooking);
  const hasActiveFilters = bookingsCommandCenterHasActiveFilters(query);
  const advancedFiltersDirty = bookingsAdvancedFiltersDirty(query);
  const showLoadMore = (listData?.nextCursor?.trim().length ?? 0) > 0;
  const inboxTitle =
    listData !== null && listData.items.length < listData.total
      ? t("inboxLoaded", {
          loaded: listData.items.length,
          total: listData.total,
        })
      : t("inbox", { count: listData?.total ?? 0 });

  const renderInboxRow = (item: (typeof displayItems)[number]) => {
    const selected = selectedBooking?.id === item.id;
    return (
      <BookingInboxRow
        key={item.id}
        item={item}
        selected={selected}
        bulkChecked={bulkSelectedIds.includes(item.id)}
        showBulkSelect={canManageOps && isBulkApprovable(item)}
        onBulkToggle={() => toggleBulkSelection(item.id)}
        onSelect={() => selectBooking(item.id)}
        showInlineApprove={shouldShowInlineApprove({
          featureEnabled: BOOKINGS_INLINE_APPROVE_ENABLED,
          canManageOps,
          item,
          selected,
          narrowViewport: isNarrowViewport,
        })}
        inlineApproveBusy={actionBusy}
        inlineApproveArmed={armedInlineApproveId === item.id}
        onInlineApprove={() => handleInlineApproveClick(item.id)}
        onInlineApproveDisarm={clearInlineApproveArm}
      />
    );
  };

  return (
    <div className="space-y-6" data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.page}>
      <PageHeader
        title={showLeaderBanner ? t("leaderReviewTitle") : t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          canManageOps ? (
            <Button asChild>
              <Link href="/bookings/new">
                <Plus className="me-1 size-4" />
                {t("newRegistration")}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="space-y-1">
        {showLeaderBanner ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.leaderAlias}
          >
            {t("leaderReviewNote")}
          </p>
        ) : null}
      </div>

      {canManageOps && summary !== null ? (
        <div
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.kpiStrip}
        >
          <BookingsKpiCard
            label={t("kpi.pending")}
            value={summary.pending}
            locale={locale}
            ariaLabel={t("kpi.pendingAria")}
            active={query.status === "pending" && query.departureWithinDays.length === 0}
            onClick={() => applyKpiFilter("pending")}
          />
          <BookingsKpiCard
            label={t("kpi.approvedToday")}
            value={summary.approvedToday}
            locale={locale}
            active={
              query.status === "approved" &&
              query.approvedWithinDays === "1" &&
              query.departureWithinDays.length === 0
            }
            onClick={() => applyKpiFilter("approvedToday")}
          />
          <BookingsKpiCard
            label={t("kpi.departures7d")}
            value={summary.departures7d}
            locale={locale}
            ariaLabel={t("kpi.departures7dAria")}
            active={query.departureWithinDays === "7"}
            onClick={() => applyKpiFilter("departures7d")}
          />
          <BookingsKpiCard
            label={t("kpi.waitlist")}
            value={summary.waitlist}
            locale={locale}
            ariaLabel={t("kpi.waitlistAria")}
            active={query.status === "waitlisted" && query.departureWithinDays.length === 0}
            onClick={() => applyKpiFilter("waitlist")}
          />
        </div>
      ) : null}

      {canManageOps ? (
        <div
          className="flex flex-col gap-2"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.primaryChrome}
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
            <BookingsOpsPresetsBar query={query} onReplaceQuery={replaceQuery} />
            <BookingsUpcomingFacetButton query={query} onReplaceQuery={replaceQuery} />
          </div>
          <p
            className="text-xs text-muted-foreground"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.presetsHint}
          >
            {t("presetsHint")}
          </p>
          {query.departureWithinDays.length > 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.departureWindowHint}
            >
              {t("departureWindowActive", { days: query.departureWithinDays })}
            </p>
          ) : null}
          {summary !== null && (summary.tourChips.length > 0 || query.tourId.length > 0) ? (
            <BookingsTourChipBar
              chips={summary.tourChips}
              query={query}
              listItems={listData?.items ?? []}
              locale={locale}
              onAllTours={() => replaceQuery({ ...query, tourId: "" })}
              onSelectTour={(tourId) => replaceQuery(toggleTourChipFilter(query, tourId))}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersDetails}
            aria-expanded={advancedFiltersOpen}
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
          >
            {t("filtersToggle")}
            {advancedFiltersDirty ? (
              <span
                className="ms-1 inline-block size-1.5 rounded-full bg-primary"
                data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersDirtyBadge}
                aria-hidden
              />
            ) : null}
          </Button>
          {canManageOps ? (
            <BookingsDisplayMenu query={query} onReplaceQuery={replaceQuery} />
          ) : null}
        </div>
      </div>

      {advancedFiltersOpen ? (
        <div
          className="rounded-md border border-border bg-muted/20 px-3 py-3"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.advancedFiltersPanel}
        >
          <BookingsFilterControls
            query={query}
            hasActiveFilters={hasActiveFilters}
            onReplaceQuery={replaceQuery}
            showTourScope={canManageOps}
          />
        </div>
      ) : null}

      {canManageOps && query.status === "all" ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.historyHint}
        >
          {t("historyHint")}
        </p>
      ) : null}

      {actionError !== null ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionError}
          role="alert"
        >
          {resolveCodedErrorMessage(tErrors, actionError)}
        </div>
      ) : null}

      {actionNotice !== null ? (
        <div
          className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice}
          role="status"
        >
          {actionNotice}
        </div>
      ) : null}

      {canManageOps && pageApprovableIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkSelectAllButton}
            onClick={toggleSelectAllApprovable}
          >
            {allPageApprovableSelected ? t("clearSelection") : t("selectAllApprovable")}
          </Button>
          {bulkApprovableIds.length > 0 ? (
            <Button
              disabled={actionBusy}
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.bulkApproveButton}
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Check className="me-1 size-4" />
              {t("bulkApprove", { count: bulkApprovableIds.length })}
            </Button>
          ) : null}
        </div>
      ) : null}

      {bodyState.type === "locked" ? (
        <Card data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.locked}>
          <CardHeader>
            <CardTitle>{t("lockedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("lockedDescription")}
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "loading" ? (
        <div className="space-y-3">
          <OperatorSkeleton size="block" />
          <OperatorSkeleton size="panel" />
        </div>
      ) : null}

      {bodyState.type === "error" ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {resolveCodedErrorMessage(tErrors, bodyState.message)}
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "empty" ? (
        <Card>
          <CardContent className="pt-6">
            <OperatorEmptyState description={t("emptyInbox")} icon="trees" />
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "emptyFiltered" ? (
        <Card>
          <CardContent className="pt-6">
            <OperatorEmptyState description={t("emptyFiltered")} icon="trees" />
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "emptyUpcoming" ? (
        <Card>
          <CardContent className="pt-6">
            <OperatorEmptyState description={t("emptyUpcoming")} icon="trees" />
          </CardContent>
        </Card>
      ) : null}

      {bodyState.type === "ready" && listData !== null ? (
        <div
          className="grid gap-4 lg:sticky lg:top-0 lg:z-10 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch"
          data-density="compact"
          data-operator-bookings-split
        >
          <Card
            className="min-w-0 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden"
            data-operator-bookings-inbox
            data-operator-surface="card"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox}
          >
            <CardHeader className="shrink-0" data-operator-inbox-header>
              <CardTitle>{inboxTitle}</CardTitle>
            </CardHeader>
            <CardContent
              className="p-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
              data-operator-booking-list
              data-queue-list="dense"
              role="listbox"
              aria-label={t("inboxLoaded", {
                loaded: displayItems.length,
                total: listData.total,
              })}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                if (event.key === "Enter" && selectedBooking !== null) {
                  selectBooking(selectedBooking.id);
                  return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  const nextId = resolveInboxSelectionAfterKey(
                    displayItems,
                    selectedId,
                    event.key
                  );
                  if (nextId !== null) {
                    selectBooking(nextId);
                  }
                }
              }}
            >
              {query.layout === "timeline"
                ? groupBookingsByDepartureDay(displayItems, locale).map((group) => (
                    <div key={group.dayKey} className="space-y-0" data-operator-inbox-group="day">
                      <p className="sticky top-0 z-[1] border-b border-border/60 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((item) => renderInboxRow(item))}
                    </div>
                  ))
                : null}
              {query.layout === "board"
                ? groupBookingsByTour(displayItems).map((group) => (
                    <div key={group.tourId} className="space-y-0" data-operator-inbox-group="tour">
                      <p className="sticky top-0 z-[1] border-b border-border/60 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        {group.tourTitle}
                      </p>
                      {group.items.map((item) => renderInboxRow(item))}
                    </div>
                  ))
                : null}
              {query.layout === "inbox" ? displayItems.map((item) => renderInboxRow(item)) : null}
              {showLoadMore ? (
                <Button
                  variant="outline"
                  className="m-2 w-[calc(100%-1rem)]"
                  disabled={loadingMore}
                  data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.loadMoreButton}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card
            className="hidden min-w-0 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden"
            data-operator-surface="card"
            data-operator-bookings-inspection
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection}
          >
            <CardHeader className="shrink-0 space-y-1">
              <CardTitle>{t("inspection")}</CardTitle>
              {inspectionTarget !== null &&
              canManageOps &&
              (canActOnSelected || canWaitlistSelected || canCancelSelected) ? (
                <p
                  className="text-xs font-normal text-muted-foreground"
                  data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.inspectionActionsHint}
                >
                  {t("inspectionActionsHint")}
                </p>
              ) : null}
            </CardHeader>
            <CardContent
              className="space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
              data-operator-bookings-inspection-body
            >
              {inspectionTarget === null ? (
                <p className="text-sm text-muted-foreground">{t("selectRegistration")}</p>
              ) : (
                <BookingInspectionDetails
                  booking={inspectionTarget}
                  locale={locale}
                  canManageOps={canManageOps}
                  canActOnSelected={canActOnSelected}
                  canWaitlistSelected={canWaitlistSelected}
                  canCancelSelected={canCancelSelected}
                  actionBusy={actionBusy}
                  idCopied={idCopied}
                  onCopyId={() => void copyBookingId(inspectionTarget.id)}
                  onReject={() => openRejectDialog(inspectionTarget.id)}
                  onApprove={() => void runBookingAction("approve", inspectionTarget.id)}
                  onWaitlist={() => void runBookingAction("waitlist", inspectionTarget.id)}
                  onCancel={() => openCancelDialog(inspectionTarget.id)}
                  actionClassName="flex"
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Sheet
        open={isNarrowViewport && mobileSheetOpen && selectedBooking !== null}
        onOpenChange={(open) => {
          if (!open) {
            clearSelection();
          } else {
            setMobileSheetOpen(true);
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-xl lg:hidden"
          data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.mobileInspectionSheet}
        >
          {inspectionTarget !== null ? (
            <>
              <SheetHeader>
                <SheetTitle>{inspectionTarget.guestLabel}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <BookingInspectionDetails
                  booking={inspectionTarget}
                  locale={locale}
                  canManageOps={canManageOps}
                  canActOnSelected={canActOnSelected}
                  canWaitlistSelected={canWaitlistSelected}
                  canCancelSelected={canCancelSelected}
                  actionBusy={actionBusy}
                  idCopied={idCopied}
                  onCopyId={() => void copyBookingId(inspectionTarget.id)}
                  onReject={() => openRejectDialog(inspectionTarget.id)}
                  onApprove={() => void runBookingAction("approve", inspectionTarget.id)}
                  onWaitlist={() => void runBookingAction("waitlist", inspectionTarget.id)}
                  onCancel={() => openCancelDialog(inspectionTarget.id)}
                  actionClassName="flex w-full flex-wrap"
                  includeActionTestIds={false}
                />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <BookingsRejectDialog
        open={rejectDialogOpen}
        reason={rejectReasonDraft}
        busy={actionBusy}
        requiresReason={rejectRequiresReason}
        canConfirm={
          rejectTargetId !== null &&
          (!rejectRequiresReason || rejectReasonDraft.trim().length > 0)
        }
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectTargetId(null);
            setRejectReasonDraft("");
          }
        }}
        onReasonChange={setRejectReasonDraft}
        onConfirm={() => void confirmReject()}
      />

      <BookingsCancelConfirmDialog
        open={cancelDialogOpen}
        busy={actionBusy}
        guestLabel={
          findSelectedBooking(displayItems, cancelTargetId)?.guestLabel ??
          inspectionTarget?.guestLabel ??
          ""
        }
        tourTitle={
          findSelectedBooking(displayItems, cancelTargetId)?.tourTitle ??
          inspectionTarget?.tourTitle ??
          ""
        }
        onOpenChange={(open) => {
          setCancelDialogOpen(open);
          if (!open) {
            setCancelTargetId(null);
          }
        }}
        onConfirm={() => void confirmCancel()}
      />

      <BookingsBulkConfirmDialog
        open={bulkConfirmOpen}
        count={bulkApprovableIds.length}
        busy={actionBusy}
        onOpenChange={setBulkConfirmOpen}
        onConfirm={() => void runBulkApprove()}
      />
    </div>
  );
}

