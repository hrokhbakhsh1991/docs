/**
 * Tour Workspace — shared TTL + in-flight coalescing for header money KPIs
 * and Finance tab reads (outstanding balances + tour-collections + pending receipts).
 *
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-COMPLETE.md §8
 */

import {
  parseOutstandingBalancesResponse,
  type OutstandingBalancesPage,
  parseTourCollectionsResponse,
  type TourCollectionsPage,
} from "@/finance/finance-outstanding-logic";
import { withFinanceTourQuery } from "@/finance/finance-registration-context";
import {
  parseFinancePendingReceiptsResponse,
  type FinancePendingReceiptsResponse,
} from "@/finance/finance-receipts-logic";

export const TOUR_WORKSPACE_FINANCE_FETCH_TTL_MS = 45_000;
export const TOUR_WORKSPACE_FINANCE_FETCH_MAX_ENTRIES = 24;
export const TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE = 25;

export const TOUR_WORKSPACE_FINANCE_CACHE_NS = {
  outstanding: "tw-finance-outstanding-balances",
  collections: "tw-finance-tour-collections",
  pendingReceipts: "tw-finance-pending-receipts",
} as const;

type CacheEntry<T> = {
  readonly at: number;
  readonly value: T;
};

const caches = new Map<string, Map<string, CacheEntry<unknown>>>();
const inflight = new Map<string, Promise<unknown>>();

function bucket(namespace: string): Map<string, CacheEntry<unknown>> {
  let map = caches.get(namespace);
  if (map === undefined) {
    map = new Map();
    caches.set(namespace, map);
  }
  return map;
}

function readCache<T>(namespace: string, tourId: string): T | null {
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  const map = bucket(namespace);
  const cached = map.get(id);
  if (cached === undefined) {
    return null;
  }
  if (Date.now() - cached.at >= TOUR_WORKSPACE_FINANCE_FETCH_TTL_MS) {
    map.delete(id);
    return null;
  }
  map.delete(id);
  map.set(id, cached);
  return cached.value as T;
}

function writeCache<T>(namespace: string, tourId: string, value: T): void {
  const id = tourId.trim();
  if (id.length === 0) {
    return;
  }
  const map = bucket(namespace);
  map.set(id, { at: Date.now(), value });
  while (map.size > TOUR_WORKSPACE_FINANCE_FETCH_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    map.delete(oldestKey);
  }
}

/** Test helper — read TTL entry without network. */
export function readTourWorkspaceFinanceCache<T>(
  namespace: string,
  tourId: string
): T | null {
  return readCache<T>(namespace, tourId);
}

/** Test helper — seed TTL entry without network. */
export function writeTourWorkspaceFinanceCache<T>(
  namespace: string,
  tourId: string,
  value: T
): void {
  writeCache(namespace, tourId, value);
}

export function invalidateTourWorkspaceFinanceCache(tourId: string): void {
  const id = tourId.trim();
  if (id.length === 0) {
    return;
  }
  bucket(TOUR_WORKSPACE_FINANCE_CACHE_NS.collections).delete(id);
  bucket(TOUR_WORKSPACE_FINANCE_CACHE_NS.pendingReceipts).delete(id);
  bucket(TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding).delete(id);
  inflight.delete(`${TOUR_WORKSPACE_FINANCE_CACHE_NS.collections}:${id}`);
  inflight.delete(`${TOUR_WORKSPACE_FINANCE_CACHE_NS.pendingReceipts}:${id}`);
  inflight.delete(`${TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding}:${id}`);
}

/** Test / HMR helper. */
export function clearTourWorkspaceFinanceCache(namespace?: string): void {
  if (namespace === undefined) {
    caches.clear();
    inflight.clear();
    return;
  }
  caches.delete(namespace);
}

export type TourWorkspaceFinanceFetchOptions = {
  readonly force?: boolean;
  readonly cursor?: string | null;
  readonly limit?: number;
};

async function loadCached<T>(
  namespace: string,
  tourId: string,
  force: boolean,
  loader: () => Promise<T>
): Promise<T> {
  const id = tourId.trim();
  if (!force) {
    const hit = readCache<T>(namespace, id);
    if (hit !== null) {
      return hit;
    }
  }
  const inflightKey = `${namespace}:${id}`;
  const existing = inflight.get(inflightKey) as Promise<T> | undefined;
  if (existing !== undefined) {
    return existing;
  }
  const promise = loader()
    .then((value) => {
      writeCache(namespace, id, value);
      return value;
    })
    .finally(() => {
      inflight.delete(inflightKey);
    });
  inflight.set(inflightKey, promise);
  return promise;
}

/**
 * GET outstanding balances scoped by tourId. On HTTP failure returns empty page
 * so the tab can fail-soft while preserving header/other finance reads.
 */
export async function loadTourWorkspaceOutstandingBalancesPage(
  tourId: string,
  options?: TourWorkspaceFinanceFetchOptions
): Promise<OutstandingBalancesPage> {
  const empty: OutstandingBalancesPage = { items: [], nextCursor: null, hasMore: false };
  const cursor = options?.cursor?.trim() ?? "";
  const limit = options?.limit ?? TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE;
  if (cursor.length > 0) {
    const base = withFinanceTourQuery(
      `/api/finance/reports/outstanding-balances?limit=${limit}`,
      tourId
    );
    const path = `${base}${base.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`;
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      return empty;
    }
    return parseOutstandingBalancesResponse(await res.json());
  }
  return loadCached(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.outstanding,
    tourId,
    options?.force === true,
    async () => {
      const path = withFinanceTourQuery(
        `/api/finance/reports/outstanding-balances?limit=${limit}`,
        tourId
      );
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        return empty;
      }
      return parseOutstandingBalancesResponse(await res.json());
    }
  );
}

/**
 * GET tour-collections scoped by tourId. On HTTP failure returns empty page
 * (header KPIs degrade; Finance tab still shows other reads if this load fails).
 */
export async function loadTourWorkspaceCollectionsPage(
  tourId: string,
  options?: TourWorkspaceFinanceFetchOptions
): Promise<TourCollectionsPage> {
  const empty: TourCollectionsPage = { items: [], nextCursor: null, hasMore: false };
  const limit = options?.limit ?? 50;
  return loadCached(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.collections,
    tourId,
    options?.force === true,
    async () => {
      const path = withFinanceTourQuery(
        `/api/finance/reports/tour-collections?limit=${limit}`,
        tourId
      );
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        return empty;
      }
      return parseTourCollectionsResponse(await res.json());
    }
  );
}

/**
 * GET pending receipts scoped by tourId. On HTTP failure returns empty page.
 */
export async function loadTourWorkspacePendingReceiptsPage(
  tourId: string,
  options?: TourWorkspaceFinanceFetchOptions
): Promise<FinancePendingReceiptsResponse> {
  const empty: FinancePendingReceiptsResponse = {
    items: [],
    nextCursor: null,
    hasMore: false,
  };
  const cursor = options?.cursor?.trim() ?? "";
  const limit = options?.limit ?? TOUR_WORKSPACE_FINANCE_LIST_PAGE_SIZE;
  if (cursor.length > 0) {
    const base = withFinanceTourQuery(
      `/api/finance/receipts/pending?limit=${limit}`,
      tourId
    );
    const path = `${base}${base.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`;
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      return empty;
    }
    return parseFinancePendingReceiptsResponse(await res.json());
  }
  return loadCached(
    TOUR_WORKSPACE_FINANCE_CACHE_NS.pendingReceipts,
    tourId,
    options?.force === true,
    async () => {
      const path = withFinanceTourQuery(
        `/api/finance/receipts/pending?limit=${limit}`,
        tourId
      );
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        return empty;
      }
      return parseFinancePendingReceiptsResponse(await res.json());
    }
  );
}
