"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { OperatorEmptyState } from "@/admin/patterns/operator-empty-state";
import { OperatorSkeleton } from "@/admin/patterns/operator-skeleton";
import { PageHeader } from "@/admin/patterns/page-header";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BookingActionNotice } from "@/features/bookings/booking-action-notice";
import { approveBookingWithoutPayment } from "@/features/bookings/booking-approve-actions-logic";
import {
  bookingActionUnavailableMessageKey,
  resolveBookingActionAvailability,
} from "@/features/bookings/booking-action-availability-logic";
import { BookingInboxRow } from "@/features/bookings/booking-inbox-row";
import { BookingInspectionDetails } from "@/features/bookings/booking-inspection-details";
import {
  BOOKINGS_INLINE_APPROVE_ENABLED,
  BOOKINGS_INLINE_APPROVE_ARM_MS,
  BOOKINGS_MOBILE_INSPECTION_MAX_WIDTH_MQ,
  bookingsCommandCenterHasActiveFilters,
  buildBookingsApiQuery,
  buildBookingsCommandCenterHref,
  buildBookingLifecycleActionNotice,
  buildRejectBookingRequestBody,
  filterBulkApprovableIds,
  findExactBooking,
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
  resolveBookingsListTotalPages,
  resolveBookingsSelectedId,
  applyDepartureWindow,
  BOOKINGS_UPCOMING_FACET_DAYS,
  resolveBookingsKpiQueryPatch,
  resolveInboxSelectionAfterKey,
  resolveInlineApproveClick,
  serializeBookingsCommandCenterQuery,
  shouldResetBookingsPagination,
  sortBookingListItems,
  shouldShowInlineApprove,
  shouldRunBookingsQueueSoftRefresh,
  BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS,
  withBookingsPaginationReset,
  type BookingsKpiFilterId,
  type BookingActionNoticeModel,
} from "@/features/bookings/bookings-command-center-logic";
import { BookingsDirectoryControls } from "@/features/bookings/bookings-directory-controls";
import { BookingsDirectoryPagination } from "@/features/bookings/bookings-directory-pagination";
import { BookingsKpiCard } from "@/features/bookings/bookings-kpi-card";
import {
  BookingsBulkConfirmDialog,
  BookingsCancelConfirmDialog,
  BookingsOverbookConfirmDialog,
  BookingsRejectDialog,
} from "@/features/bookings/bookings-ops-dialogs";
import {
  groupBookingsByDepartureDay,
  groupBookingsByTour,
} from "@/features/bookings/bookings-ops-path-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  BOOKINGS_LIST_PAGE_SIZE,
  isAdminOrOwnerRole,
  resolveBookingsViewForRole,
  type BookingListItem,
  type BookingStatus,
  type BookingsCommandCenterQuery,
  type BookingsListResponse,
  type BookingsSummaryResponse,
} from "@/features/bookings/bookings-command-center-types";
import { workspaceBasePath } from "@/features/tours/tour-workspace-logic";
import { invalidateTourWorkspaceFinanceCache } from "@/features/tours/tour-workspace-finance-fetch-cache";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";
import { isTourCapacityFull } from "@/features/tours/tour-workspace-waitlist-logic";

import type { AppLocale } from "@/i18n/routing";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { resolveBookingsPageBodyState } from "@/features/bookings/bookings-command-center-gate";
import type { BookingsServerPrefetch } from "@/features/bookings/fetch-bookings-list.server";
import {
  DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
  type BookingsOpsActionChrome,
} from "@/features/bookings/bookings-ops-action-chrome";

/**
 * Registrations / waitlist Workspace embed + `/bookings` Command Center shell.
 * TW-C-01 / HARDENING I-07 — single implementation in features (not app-only).
 * App route re-exports: `app/(app)/bookings/bookings-page-client.tsx`
 */
type BookingsPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly leaderAlias?: boolean;
  readonly initialPrefetch?: BookingsServerPrefetch | null;
  /** UX-BKG-46 — defaults when omitted (stories / legacy callers). */
  readonly opsActions?: BookingsOpsActionChrome;
  /**
   * TW-C-01 — Tour Workspace embed: lock inbox to one tour (hide tour chips).
   * @see docs/phase-9/appendices/TOURS-WORKSPACE-COMPLETE.md §6
   */
  readonly lockedTourId?: string;
  /** Compact chrome when mounted under `/tours/[id]/workspace`. */
  readonly embedded?: boolean;
  /**
   * HARDENING H4b — lock Command Center status filter (e.g. waitlisted tab).
   * When set with `embedded`, status cannot be cleared via chrome.
   */
  readonly lockedStatus?: BookingStatus;
  /**
   * HARDENING H-03 — Tour Workspace chrome reload after approve/reject/waitlist/cancel/bulk.
   * Invoked only after a successful mutation (not list soft-refresh).
   */
  readonly onOpsMutationSuccess?: () => void;
  /**
   * H-08 / H2-T2 — when set and at capacity, approve requires overbook confirm (waitlist embed).
   */
  readonly tourCapacityGuard?: {
    readonly acceptedCount: number;
    readonly totalCapacity: number | null;
  };
};

export function BookingsPageClient({
  session,
  leaderAlias = false,
  initialPrefetch = null,
  opsActions = DEFAULT_BOOKINGS_OPS_ACTION_CHROME,
  lockedTourId,
  embedded = false,
  lockedStatus,
  onOpsMutationSuccess,
  tourCapacityGuard,
}: BookingsPageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("bookings");
  const tErrors = useTranslations("bookings.errors");
  const tWorkspace = useTranslations("tours.workspace");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const bulkApproveMaxBatch = opsActions.bulkApproveMaxBatch;
  const rejectRequiresReason = opsActions.rejectRequiresReason;
  const lockedTour = lockedTourId?.trim() ?? "";
  const parsedQuery = useMemo(
    () => parseBookingsCommandCenterQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const canManageOps = isAdminOrOwnerRole(session.role);
  const urlQuery: BookingsCommandCenterQuery = useMemo(
    () => ({
      ...parsedQuery,
      view: resolveBookingsViewForRole(session.role, parsedQuery.view),
      ...(leaderAlias ? { scope: "leader", view: "ops" } : {}),
      ...(lockedTour.length > 0 ? { tourId: lockedTour } : {}),
    }),
    [leaderAlias, lockedTour, parsedQuery, session.role]
  );
  const lockedStatusFilter = lockedStatus?.trim() ?? "";
  const [embeddedQuery, setEmbeddedQuery] = useState<BookingsCommandCenterQuery>(() => ({
    ...urlQuery,
    ...(lockedTour.length > 0 ? { tourId: lockedTour } : {}),
    ...(lockedStatusFilter.length > 0
      ? { status: lockedStatusFilter as BookingsCommandCenterQuery["status"] }
      : {}),
  }));
  const query: BookingsCommandCenterQuery = embedded ? embeddedQuery : urlQuery;
  const isWorkspaceEmbed = embedded && lockedTour.length > 0;

  const [searchInput, setSearchInput] = useState(query.search);
  const [listData, setListData] = useState<BookingsListResponse | null>(
    initialPrefetch?.list ?? null
  );
  const [summary, setSummary] = useState<BookingsSummaryResponse | null>(
    initialPrefetch?.summary ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | BookingActionNoticeModel | null>(null);
  const [loading, setLoading] = useState(initialPrefetch === null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialPrefetch !== null);
  const lastFetchSucceededAtRef = useRef<number | null>(
    initialPrefetch !== null ? Date.now() : null
  );
  const pageStartCursorsRef = useRef<Record<number, string>>({ 1: "" });
  const listDataRef = useRef(listData);
  listDataRef.current = listData;
  const queryRef = useRef(query);
  queryRef.current = query;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
      new URLSearchParams(searchParams.toString())
    );
    return resolveBookingsSelectedId({
      bookingIdFromUrl,
      currentSelectedId: null,
      items: initialPrefetch?.list.items ?? [],
    });
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
  const [overbookConfirmOpen, setOverbookConfirmOpen] = useState(false);
  const [overbookConfirmBookingId, setOverbookConfirmBookingId] = useState<string | null>(null);
  const [overbookConfirmMode, setOverbookConfirmMode] = useState<
    "approve" | "approve_without_payment"
  >("approve");
  const [armedInlineApproveId, setArmedInlineApproveId] = useState<string | null>(null);
  const [inspectionBooking, setInspectionBooking] = useState<BookingListItem | null>(null);
  const inlineApproveArmTimeoutRef = useRef<number | null>(null);

  const replaceQuery = (
    next: BookingsCommandCenterQuery,
    options?: { preservePagination?: boolean }
  ) => {
    const shouldReset =
      options?.preservePagination !== true &&
      shouldResetBookingsPagination(queryRef.current, next);
    let scoped = shouldReset ? withBookingsPaginationReset(next) : next;
    if (shouldReset) {
      pageStartCursorsRef.current = { 1: "" };
    }
    scoped = lockedTour.length > 0 ? { ...scoped, tourId: lockedTour } : scoped;
    if (lockedStatusFilter.length > 0) {
      scoped = {
        ...scoped,
        status: lockedStatusFilter as BookingsCommandCenterQuery["status"],
      };
    }
    if (embedded) {
      setEmbeddedQuery(scoped);
      return;
    }
    const serialized = serializeBookingsCommandCenterQuery(scoped);
    router.replace(serialized.length > 0 ? `${pathname}?${serialized}` : pathname, {
      scroll: false,
    });
  };

  const goToBookingsPage = (nextPage: number) => {
    const listCursor = pageStartCursorsRef.current[nextPage] ?? "";
    replaceQuery(
      {
        ...queryRef.current,
        page: nextPage,
        listCursor,
      },
      { preservePagination: true }
    );
  };

  const selectBooking = (bookingId: string) => {
    clearInlineApproveArm();
    setSelectedId(bookingId);
    if (embedded) {
      return;
    }
    router.replace(buildBookingsCommandCenterHref(pathname, query, bookingId), {
      scroll: false,
    });
  };

  const clearSelection = () => {
    setSelectedId(null);
    setMobileSheetOpen(false);
    if (embedded) {
      return;
    }
    router.replace(buildBookingsCommandCenterHref(pathname, query, null), {
      scroll: false,
    });
  };

  useEffect(() => {
    if (!embedded) {
      return;
    }
    setEmbeddedQuery((prev) => ({
      ...prev,
      tourId: lockedTour,
      view: resolveBookingsViewForRole(session.role, prev.view),
      ...(lockedStatusFilter.length > 0
        ? { status: lockedStatusFilter as BookingsCommandCenterQuery["status"] }
        : {}),
    }));
  }, [embedded, lockedStatusFilter, lockedTour, session.role]);

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

    const apiQuery = buildBookingsApiQuery(query, {
      cursor: query.page > 1 ? query.listCursor : undefined,
      limit: BOOKINGS_LIST_PAGE_SIZE,
    });
    const listPromise = fetch(`/api/bookings?${apiQuery}`, { cache: "no-store" });
    const summaryQs = buildBookingsSummaryApiQuery(query);
    const summaryPromise = canManageOps
      ? fetch(
          summaryQs.length > 0 ? `/api/bookings/summary?${summaryQs}` : "/api/bookings/summary",
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
          if (listJson.nextCursor) {
            pageStartCursorsRef.current[query.page + 1] = listJson.nextCursor;
          }
          setSummary(summaryJson);
          const bookingIdFromUrl = readBookingIdFromCommandCenterParams(
            new URLSearchParams(searchParams.toString())
          );
          setSelectedId((current) => {
            return resolveBookingsSelectedId({
              bookingIdFromUrl,
              currentSelectedId: current,
              items: listJson.items,
            });
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

  const selectedBooking = findExactBooking(displayItems, selectedId);

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
    const listRow = findExactBooking(displayItems, selectedId);
    if (listRow !== null) {
      setInspectionBooking(listRow);
    } else {
      setInspectionBooking((current) => (current?.id === selectedId ? current : null));
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

  const inspectionTarget =
    inspectionBooking?.id === selectedId ? inspectionBooking : selectedBooking;

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
          loadingMore: loading,
          dialogOpen: rejectDialogOpen || bulkConfirmOpen || cancelDialogOpen,
        })
      ) {
        return;
      }
      softRefreshData();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [actionBusy, bulkConfirmOpen, cancelDialogOpen, loading, rejectDialogOpen]);

  const bulkApprovableIds = useMemo(
    () => filterBulkApprovableIds(listData?.items ?? [], bulkSelectedIds, bulkApproveMaxBatch),
    [bulkApproveMaxBatch, bulkSelectedIds, listData?.items]
  );
  const pageApprovableIds = useMemo(
    () => listBulkApprovableIds(listData?.items ?? [], bulkApproveMaxBatch),
    [bulkApproveMaxBatch, listData?.items]
  );
  const allPageApprovableSelected =
    pageApprovableIds.length > 0 && pageApprovableIds.every((id) => bulkSelectedIds.includes(id));

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
      } else if (result.approvedIds.length > 0) {
        setActionNotice(t("bulkApproveSuccess", { count: result.approvedIds.length }));
      }
      refreshData();
      onOpsMutationSuccess?.();
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
      requestApprove(bookingId);
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
    const snapshot = findSelectedBooking(listDataRef.current?.items ?? [], bookingId);
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
      if (action === "approve" && embedded && lockedTour.trim().length > 0) {
        invalidateFinanceRegistrationCaches(bookingId);
        invalidateTourWorkspaceFinanceCache(lockedTour);
      }
      if (snapshot !== null) {
        const notice = buildBookingLifecycleActionNotice({
          action,
          guestLabel: snapshot.guestLabel,
          paymentStatus: snapshot.paymentStatus,
          embedded,
          lockedTourId: lockedTour,
          registrationId: bookingId,
        });
        if (notice.kind !== "none") {
          setActionNotice(notice);
        }
      }
      refreshData();
      onOpsMutationSuccess?.();
    } catch (actionErr: unknown) {
      setActionError(actionErr instanceof Error ? actionErr.message : "BOOKINGS_ACTION_FAILED");
    } finally {
      setActionBusy(false);
    }
  };

  const requestApprove = (bookingId: string) => {
    if (tourCapacityGuard !== undefined && isTourCapacityFull(tourCapacityGuard)) {
      setOverbookConfirmMode("approve");
      setOverbookConfirmBookingId(bookingId);
      setOverbookConfirmOpen(true);
      return;
    }
    void runBookingAction("approve", bookingId);
  };

  const confirmOverbookApprove = async () => {
    if (overbookConfirmBookingId === null) {
      return;
    }
    const bookingId = overbookConfirmBookingId;
    const mode = overbookConfirmMode;
    setOverbookConfirmOpen(false);
    setOverbookConfirmBookingId(null);
    setOverbookConfirmMode("approve");
    if (mode === "approve_without_payment") {
      await runApproveWithoutPayment(bookingId);
      return;
    }
    await runBookingAction("approve", bookingId);
  };

  const runApproveWithoutPayment = async (bookingId: string) => {
    const snapshot = findSelectedBooking(listDataRef.current?.items ?? [], bookingId);
    setActionBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await approveBookingWithoutPayment(bookingId);
      if (embedded && lockedTour.trim().length > 0) {
        invalidateTourWorkspaceFinanceCache(lockedTour);
      }
      if (snapshot !== null) {
        setActionNotice(t("approveWithoutPaymentSuccess", { guest: snapshot.guestLabel }));
      }
      refreshData();
      onOpsMutationSuccess?.();
    } catch (actionErr: unknown) {
      setActionError(
        actionErr instanceof Error ? actionErr.message : "BOOKINGS_APPROVE_WITHOUT_PAYMENT_FAILED"
      );
    } finally {
      setActionBusy(false);
    }
  };

  const requestApproveWithoutPayment = (bookingId: string) => {
    if (tourCapacityGuard !== undefined && isTourCapacityFull(tourCapacityGuard)) {
      setOverbookConfirmMode("approve_without_payment");
      setOverbookConfirmBookingId(bookingId);
      setOverbookConfirmOpen(true);
      return;
    }
    void runApproveWithoutPayment(bookingId);
  };

  const showLeaderBanner = !embedded && (leaderAlias || isLeaderReviewAlias(query.scope));
  const canActOnSelected =
    canManageOps &&
    inspectionTarget !== null &&
    (inspectionTarget.status === "pending" || inspectionTarget.status === "waitlisted");
  const canWaitlistSelected =
    canManageOps && inspectionTarget !== null && isBookingWaitlistable(inspectionTarget);
  const canCancelSelected =
    canManageOps && inspectionTarget !== null && isBookingCancellable(inspectionTarget);
  const capacityFull = tourCapacityGuard !== undefined && isTourCapacityFull(tourCapacityGuard);
  const actionAvailability = useMemo(
    () =>
      resolveBookingActionAvailability({
        canManageOps,
        booking: inspectionTarget,
        isWaitlistable: canWaitlistSelected,
        isCancellable: canCancelSelected,
        capacityFull,
      }),
    [canCancelSelected, canManageOps, canWaitlistSelected, capacityFull, inspectionTarget]
  );
  const actionUnavailableHint = useMemo(() => {
    if (actionAvailability.unavailableReason === "approved_use_finance" && !canActOnSelected) {
      return t("actionReason.approvedUseFinance");
    }
    if (
      actionAvailability.unavailableReason !== null &&
      !canActOnSelected &&
      !canWaitlistSelected &&
      !canCancelSelected
    ) {
      const key = bookingActionUnavailableMessageKey(actionAvailability.unavailableReason);
      return t.has(key) ? t(key) : null;
    }
    return null;
  }, [
    actionAvailability.unavailableReason,
    canActOnSelected,
    canCancelSelected,
    canWaitlistSelected,
    t,
  ]);
  const capacityFullHint =
    actionAvailability.showCapacityFullHint && canActOnSelected
      ? t("actionReason.capacityFull")
      : null;
  const totalPages =
    listData !== null ? resolveBookingsListTotalPages(listData.total, BOOKINGS_LIST_PAGE_SIZE) : 1;
  const inboxTitle =
    listData !== null
      ? t("inboxPage", {
          page: query.page,
          totalPages,
          total: listData.total,
        })
      : t("inbox", { count: 0 });

  const renderInboxRow = (item: (typeof displayItems)[number]) => {
    const selected = selectedBooking?.id === item.id;
    return (
      <Fragment key={item.id}>
        {item.status === "cancelled" && item.cancelSource === "payment_deadline" ? (
          <span className="sr-only" data-operator-booking-cancel-source>
            payment_deadline
          </span>
        ) : null}
        <BookingInboxRow
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
          showTourTitle={!isWorkspaceEmbed}
        />
      </Fragment>
    );
  };

  return (
    <div
      className="space-y-6"
      data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.page}
      data-bookings-embedded={embedded ? "true" : undefined}
      data-bookings-locked-tour={lockedTour.length > 0 ? lockedTour : undefined}
    >
      {embedded ? null : (
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
      )}
      {!embedded && query.tourId.trim().length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            data-testid="operator-bookings-open-tour-workspace"
          >
            <Link href={workspaceBasePath(query.tourId)}>{tWorkspace("openWorkspace")}</Link>
          </Button>
        </div>
      ) : null}
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

      {canManageOps && summary !== null && !embedded ? (
        <div
          className="flex flex-wrap items-center gap-2"
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

      <BookingsDirectoryControls
        query={query}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onReplaceQuery={replaceQuery}
        tourChips={summary?.tourChips ?? []}
        showTourFilter={
          canManageOps &&
          !embedded &&
          lockedTour.length === 0 &&
          summary !== null &&
          (summary.tourChips.length > 0 || query.tourId.length > 0)
        }
        showTourScope={!embedded && canManageOps}
      />

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
        typeof actionNotice === "string" ? (
          <div
            className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
            data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice}
            role="status"
          >
            {actionNotice}
          </div>
        ) : (
          <BookingActionNotice notice={actionNotice} lockedTourId={lockedTour} />
        )
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
          {bulkSelectedIds.length > 0 && bulkApprovableIds.length > 0 ? (
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
                  const nextId = resolveInboxSelectionAfterKey(displayItems, selectedId, event.key);
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
              <BookingsDirectoryPagination
                page={query.page}
                totalPages={totalPages}
                total={listData.total}
                disabled={loading}
                onPageChange={goToBookingsPage}
              />
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
                  onApprove={() => requestApprove(inspectionTarget.id)}
                  onApproveWithoutPayment={() => requestApproveWithoutPayment(inspectionTarget.id)}
                  onWaitlist={() => void runBookingAction("waitlist", inspectionTarget.id)}
                  onCancel={() => openCancelDialog(inspectionTarget.id)}
                  actionClassName="flex"
                  actionHint={actionUnavailableHint}
                  capacityFullHint={capacityFullHint}
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Sheet
        open={isNarrowViewport && mobileSheetOpen && inspectionTarget !== null}
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
                  onApprove={() => requestApprove(inspectionTarget.id)}
                  onApproveWithoutPayment={() => requestApproveWithoutPayment(inspectionTarget.id)}
                  onWaitlist={() => void runBookingAction("waitlist", inspectionTarget.id)}
                  onCancel={() => openCancelDialog(inspectionTarget.id)}
                  actionClassName="flex w-full flex-wrap"
                  actionHint={actionUnavailableHint}
                  capacityFullHint={capacityFullHint}
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
          rejectTargetId !== null && (!rejectRequiresReason || rejectReasonDraft.trim().length > 0)
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

      <BookingsOverbookConfirmDialog
        open={overbookConfirmOpen}
        busy={actionBusy}
        guestLabel={
          findSelectedBooking(displayItems, overbookConfirmBookingId)?.guestLabel ??
          inspectionTarget?.guestLabel ??
          ""
        }
        onOpenChange={(open) => {
          setOverbookConfirmOpen(open);
          if (!open) {
            setOverbookConfirmBookingId(null);
          }
        }}
        onConfirm={() => void confirmOverbookApprove()}
      />
    </div>
  );
}

/** Prefer this name for Workspace embeds (I-07). Same component as `/bookings` page client. */
export { BookingsPageClient as BookingsCommandCenterShell };
