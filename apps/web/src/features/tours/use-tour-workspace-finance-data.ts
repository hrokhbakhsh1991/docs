"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  OutstandingBalanceListItem,
  OutstandingBalancesPage,
  TourCollectionListItem,
  TourCollectionsPage,
} from "@/finance/finance-outstanding-logic";
import type {
  FinancePendingReceipt,
  FinancePendingReceiptsResponse,
} from "@/finance/finance-receipts-logic";
import {
  invalidateTourWorkspaceFinanceCache,
  loadTourWorkspaceCollectionsPage,
  loadTourWorkspaceOutstandingBalancesPage,
  loadTourWorkspacePendingReceiptsPage,
  readTourWorkspaceFinanceCache,
  TOUR_WORKSPACE_FINANCE_CACHE_NS,
  TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE,
} from "@/features/tours/tour-workspace-finance-fetch-cache";
import { toFinanceClientErrorCode } from "@/i18n/resolve-finance-error-message";

type TourWorkspaceFinanceDataState = {
  readonly loading: boolean;
  /** True only when a first paint would be an empty skeleton (PAY-FIN-01). */
  readonly panelBlocking: boolean;
  readonly error: string | null;
  readonly outstanding: readonly OutstandingBalanceListItem[];
  readonly tours: readonly TourCollectionListItem[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly receiptsHasMore: boolean;
  readonly guestRowsHasMore: boolean;
  readonly loadingMore: boolean;
  readonly degradedSections: readonly TourWorkspaceFinanceSection[];
  readonly loadSucceeded: boolean;
  readonly refresh: () => void;
  readonly loadMore: () => void;
};

/**
 * PAY-FIN-01 — do not blank the finance panel when header cache already warmed
 * collections/receipts (or a prior tab load left rows). Skeleton only when we
 * have nothing actionable to paint yet.
 */
export function shouldBlockTourFinancePanelSkeleton(input: {
  readonly loading: boolean;
  readonly outstandingCount: number;
  readonly receiptCount: number;
}): boolean {
  return input.loading && input.outstandingCount === 0 && input.receiptCount === 0;
}

function readCachedFinanceSeed(tourId: string): {
  readonly outstanding: readonly OutstandingBalanceListItem[];
  readonly tours: readonly TourCollectionListItem[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly outstandingNextCursor: string | null;
  readonly outstandingHasMore: boolean;
  readonly receiptsNextCursor: string | null;
  readonly receiptsHasMore: boolean;
} {
  const outstandingPage = readTourWorkspaceFinanceCache<OutstandingBalancesPage>(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding,
    tourId
  );
  const collectionsPage = readTourWorkspaceFinanceCache<TourCollectionsPage>(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.collections,
    tourId
  );
  const receiptsPage = readTourWorkspaceFinanceCache<FinancePendingReceiptsResponse>(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.pendingReceipts,
    tourId
  );
  return {
    outstanding: outstandingPage?.items ?? [],
    tours: collectionsPage?.items ?? [],
    receipts: receiptsPage?.items ?? [],
    outstandingNextCursor: outstandingPage?.nextCursor ?? null,
    outstandingHasMore: outstandingPage?.hasMore === true,
    receiptsNextCursor: receiptsPage?.nextCursor ?? null,
    receiptsHasMore: receiptsPage?.hasMore === true,
  };
}

export type TourWorkspaceFinanceSection = "outstanding" | "tours" | "receipts";

type TourWorkspaceFinanceReadResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly value: T;
      readonly error: string;
    };

type TourWorkspaceFinanceLoadOutcome = {
  readonly outstanding: readonly OutstandingBalanceListItem[];
  readonly tours: readonly TourCollectionListItem[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly receiptsHasMore: boolean;
  readonly outstandingNextCursor: string | null;
  readonly outstandingHasMore: boolean;
  readonly receiptsNextCursor: string | null;
  readonly degradedSections: readonly TourWorkspaceFinanceSection[];
  readonly error: string | null;
  readonly loadSucceeded: boolean;
};

const EMPTY_OUTSTANDING_BALANCES_PAGE: OutstandingBalancesPage = {
  items: [],
  nextCursor: null,
  hasMore: false,
};

const EMPTY_TOUR_COLLECTIONS_PAGE: TourCollectionsPage = {
  items: [],
  nextCursor: null,
  hasMore: false,
};

const EMPTY_PENDING_RECEIPTS_PAGE: FinancePendingReceiptsResponse = {
  items: [],
  nextCursor: null,
  hasMore: false,
};

async function settleTourWorkspaceFinanceRead<T>(
  loader: () => Promise<T>,
  fallback: T,
  fallbackCode: string
): Promise<TourWorkspaceFinanceReadResult<T>> {
  try {
    return { ok: true, value: await loader() };
  } catch (error: unknown) {
    return {
      ok: false,
      value: fallback,
      error: toFinanceClientErrorCode(error, fallbackCode),
    };
  }
}

export function resolveTourWorkspaceFinanceLoadOutcome(input: {
  readonly outstanding: TourWorkspaceFinanceReadResult<OutstandingBalancesPage>;
  readonly tours: TourWorkspaceFinanceReadResult<TourCollectionsPage>;
  readonly receipts: TourWorkspaceFinanceReadResult<FinancePendingReceiptsResponse>;
}): TourWorkspaceFinanceLoadOutcome {
  const reads = [input.outstanding, input.tours, input.receipts];
  const loadSucceeded = reads.some((read) => read.ok);
  const firstError = reads.find((read) => !read.ok && "error" in read)?.error ?? null;
  const degradedSections: TourWorkspaceFinanceSection[] = [];

  if (!input.outstanding.ok) {
    degradedSections.push("outstanding");
  }
  if (!input.tours.ok) {
    degradedSections.push("tours");
  }
  if (!input.receipts.ok) {
    degradedSections.push("receipts");
  }

  return {
    outstanding: input.outstanding.value.items,
    tours: input.tours.value.items,
    receipts: input.receipts.value.items,
    receiptsHasMore: input.receipts.value.hasMore === true,
    outstandingNextCursor: input.outstanding.value.nextCursor,
    outstandingHasMore: input.outstanding.value.hasMore === true,
    receiptsNextCursor: input.receipts.value.nextCursor,
    degradedSections,
    error: loadSucceeded ? null : firstError,
    loadSucceeded,
  };
}

export function useTourWorkspaceFinanceData(
  tourId: string
): TourWorkspaceFinanceDataState {
  const [initialSeed] = useState(() => readCachedFinanceSeed(tourId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<readonly OutstandingBalanceListItem[]>(
    () => initialSeed.outstanding
  );
  const [tours, setTours] = useState<readonly TourCollectionListItem[]>(() => initialSeed.tours);
  const [receipts, setReceipts] = useState<readonly FinancePendingReceipt[]>(
    () => initialSeed.receipts
  );
  const [receiptsHasMore, setReceiptsHasMore] = useState(() => initialSeed.receiptsHasMore);
  const [outstandingNextCursor, setOutstandingNextCursor] = useState<string | null>(
    () => initialSeed.outstandingNextCursor
  );
  const [outstandingHasMore, setOutstandingHasMore] = useState(
    () => initialSeed.outstandingHasMore
  );
  const [receiptsNextCursor, setReceiptsNextCursor] = useState<string | null>(
    () => initialSeed.receiptsNextCursor
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [degradedSections, setDegradedSections] = useState<
    readonly TourWorkspaceFinanceSection[]
  >([]);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const [fetchNonce, setFetchNonce] = useState(0);

  const refresh = useCallback(() => {
    setFetchNonce((n) => n + 1);
  }, []);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      if (force) {
        invalidateTourWorkspaceFinanceCache(tourId);
      }
      try {
        const [outstandingRead, toursRead, receiptsRead] = await Promise.all([
          settleTourWorkspaceFinanceRead(
            () =>
              loadTourWorkspaceOutstandingBalancesPage(tourId, {
                force,
                limit: TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE,
              }),
            EMPTY_OUTSTANDING_BALANCES_PAGE,
            "OUTSTANDING_FETCH_FAILED"
          ),
          settleTourWorkspaceFinanceRead(
            () => loadTourWorkspaceCollectionsPage(tourId, { force }),
            EMPTY_TOUR_COLLECTIONS_PAGE,
            "TOUR_COLLECTIONS_FETCH_FAILED"
          ),
          settleTourWorkspaceFinanceRead(
            () =>
              loadTourWorkspacePendingReceiptsPage(tourId, {
                force,
                limit: TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE,
              }),
            EMPTY_PENDING_RECEIPTS_PAGE,
            "RECEIPTS_FETCH_FAILED"
          ),
        ]);
        const outcome = resolveTourWorkspaceFinanceLoadOutcome({
          outstanding: outstandingRead,
          tours: toursRead,
          receipts: receiptsRead,
        });
        setOutstanding(outcome.outstanding);
        setTours(outcome.tours);
        setReceipts(outcome.receipts);
        setReceiptsHasMore(outcome.receiptsHasMore);
        setOutstandingNextCursor(outcome.outstandingNextCursor);
        setOutstandingHasMore(outcome.outstandingHasMore);
        setReceiptsNextCursor(outcome.receiptsNextCursor);
        setDegradedSections(outcome.degradedSections);
        setError(outcome.error);
        setLoadSucceeded(outcome.loadSucceeded);
      } finally {
        setLoading(false);
      }
    },
    [tourId]
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || (!outstandingHasMore && !receiptsHasMore)) {
      return;
    }
    setLoadingMore(true);
    void Promise.all([
      outstandingHasMore && outstandingNextCursor !== null
        ? loadTourWorkspaceOutstandingBalancesPage(tourId, {
            cursor: outstandingNextCursor,
            limit: TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE,
          })
        : Promise.resolve(EMPTY_OUTSTANDING_BALANCES_PAGE),
      receiptsHasMore && receiptsNextCursor !== null
        ? loadTourWorkspacePendingReceiptsPage(tourId, {
            cursor: receiptsNextCursor,
            limit: TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE,
          })
        : Promise.resolve(EMPTY_PENDING_RECEIPTS_PAGE),
    ])
      .then(([outstandingPage, receiptsPage]) => {
        setOutstanding((current) => {
          const seen = new Set(current.map((row) => row.registrationId));
          const appended = outstandingPage.items.filter((row) => !seen.has(row.registrationId));
          return [...current, ...appended];
        });
        setReceipts((current) => {
          const seen = new Set(current.map((row) => row.id));
          const appended = receiptsPage.items.filter((row) => !seen.has(row.id));
          return [...current, ...appended];
        });
        setOutstandingNextCursor(outstandingPage.nextCursor);
        setOutstandingHasMore(outstandingPage.hasMore);
        setReceiptsNextCursor(receiptsPage.nextCursor);
        setReceiptsHasMore(receiptsPage.hasMore);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [
    loading,
    loadingMore,
    outstandingHasMore,
    outstandingNextCursor,
    receiptsHasMore,
    receiptsNextCursor,
    tourId,
  ]);

  useEffect(() => {
    void load(fetchNonce > 0);
  }, [fetchNonce, load]);

  const panelBlocking = shouldBlockTourFinancePanelSkeleton({
    loading,
    outstandingCount: outstanding.length,
    receiptCount: receipts.length,
  });

  return {
    loading,
    panelBlocking,
    error,
    outstanding,
    tours,
    receipts,
    receiptsHasMore,
    guestRowsHasMore: outstandingHasMore || receiptsHasMore,
    loadingMore,
    degradedSections,
    loadSucceeded,
    refresh,
    loadMore,
  };
}
