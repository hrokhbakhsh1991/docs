"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { tourKeys } from "@/lib/query-keys";
import { getTours, toursUseLiveApi } from "@/lib/services/tours.service";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  cn,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
} from "@tour/ui";

import { TourList } from "./components/TourList";
import { ToursListSkeleton } from "./components/ToursListSkeleton";
import { filterToursByStatus, sortTours, type TourSortColumn, type TourStatusFilter } from "./tours-list-logic";

import styles from "./tours-list-view.module.css";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function toursErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "Tours could not be found.";
    }
    return error.message.trim() || "Could not load tours.";
  }
  return "Could not load tours. Check your connection and try again.";
}

function noMatchDescription(debouncedSearch: string, statusFilter: TourStatusFilter): string {
  const q = debouncedSearch.trim();
  if (q && statusFilter !== "all") {
    return `No tours matched "${q}" with the current status filter. Try All statuses or different keywords.`;
  }
  if (q) {
    return `No tours matched "${q}". Try different keywords or clear the search.`;
  }
  if (statusFilter !== "all") {
    return "No tours match the selected status on this page. Try setting status to All.";
  }
  return "Adjust search or filters and try again.";
}

export function ToursListView() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuth();
  const liveApi = toursUseLiveApi();
  const tourQueryEnabled = liveApi && isHydrated && isAuthenticated;

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<TourStatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<TourSortColumn>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const {
    data,
    isPending,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: tourKeys.list({ search: debouncedSearch }),
    queryFn: () => getTours({ search: debouncedSearch }),
    enabled: tourQueryEnabled,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  const fetchedTours = useMemo(() => data?.tours ?? [], [data?.tours]);

  const toursAfterStatusFilter = useMemo(() => {
    return filterToursByStatus(fetchedTours, statusFilter);
  }, [fetchedTours, statusFilter]);

  const sortedToursFull = useMemo(() => {
    return sortTours(toursAfterStatusFilter, { sortColumn, sortDir });
  }, [toursAfterStatusFilter, sortColumn, sortDir]);

  const totalPages =
    sortedToursFull.length === 0 ? 0 : Math.ceil(sortedToursFull.length / PAGE_SIZE);

  useEffect(() => {
    if (totalPages === 0) return;
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  const effectivePage = totalPages === 0 ? 1 : Math.min(Math.max(1, page), totalPages);

  const sortedTours = useMemo(() => {
    const start = (effectivePage - 1) * PAGE_SIZE;
    return sortedToursFull.slice(start, start + PAGE_SIZE);
  }, [sortedToursFull, effectivePage]);

  const searchStale = searchInput.trim() !== debouncedSearch.trim();
  const handleSelectTour = useCallback(
    (id: string) => router.push(`/tours/${encodeURIComponent(id)}`),
    [router]
  );
  const toggleTourSort = useCallback((column: TourSortColumn) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, [sortColumn]);

  let body: ReactNode;

  if (liveApi && !isHydrated) {
    body = (
      <Card>
        <CardBody>
          <LoadingState message="Loading session…" />
        </CardBody>
      </Card>
    );
  } else if (liveApi && isHydrated && !isAuthenticated) {
    body = (
      <Card>
        <CardBody>
          <EmptyState
            title="Sign in required"
            description="Your session is missing or expired. Sign in to load tours from the workspace API."
            action={
              <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                Sign in
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  } else if (isPending) {
    body = (
      <Card className={styles.listShell}>
        <CardHeader className={styles.listCardHeader}>
          <div className={styles.toolbarSkeleton} aria-hidden>
            <div className={`${styles.toolbarSkeletonBar} ${styles.toolbarSkeletonGrow}`} />
            <div className={`${styles.toolbarSkeletonBar} ${styles.toolbarSkeletonFixed}`} />
          </div>
          <div className={styles.sortSkeleton}>
            <div className={styles.sortSkeletonChip} />
            <div className={styles.sortSkeletonChip} />
          </div>
        </CardHeader>
        <CardBody>
          <ToursListSkeleton count={6} />
        </CardBody>
      </Card>
    );
  } else if (isError) {
    body = (
      <Card>
        <CardBody>
          <ErrorState
            title="Could not load tours"
            message={toursErrorMessage(queryError)}
            onRetry={() => {
              void refetch();
            }}
          />
        </CardBody>
      </Card>
    );
  } else if (fetchedTours.length === 0 && debouncedSearch === "") {
    body = (
      <Card>
        <CardBody>
          <EmptyState
            title="No tours yet"
            description={
              liveApi
                ? "When your tenant has tours, they will appear here. Create one with Create Tour (requires API), or add tours via your workspace tools."
                : "Create your first tour with Create Tour."
            }
            action={
              <Button type="button" variant="primary" onClick={() => router.push("/tours/new")}>
                Create tour
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  } else {
    body = (
      <Card className={styles.listShell} aria-busy={isFetching ? true : undefined}>
        <CardHeader className={styles.listCardHeader}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarGrow}>
              <FormField
                label="Search"
                description={
                  liveApi
                    ? `Title and description (debounced ${SEARCH_DEBOUNCE_MS}ms).${searchStale ? " Updating…" : ""}`
                    : `Title and description (debounced ${SEARCH_DEBOUNCE_MS}ms).`
                }
              >
                <Input
                  type="search"
                  placeholder="Search tours…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  autoComplete="off"
                  aria-label="Search tours"
                />
              </FormField>
            </div>
            <div className={styles.toolbarFixed}>
              <FormField label="Status">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TourStatusFilter)}
                >
                  <option value="all">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Archived">Archived</option>
                </Select>
              </FormField>
            </div>
          </div>
          <div className={styles.sortBar} role="group" aria-label="Sort tours">
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="sm" onClick={() => toggleTourSort("title")}>
                Sort by title
              </Button>
              {sortColumn === "title" ? <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span> : null}
            </span>
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="sm" onClick={() => toggleTourSort("price")}>
                Sort by price
              </Button>
              {sortColumn === "price" ? <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span> : null}
            </span>
          </div>
        </CardHeader>
        <CardBody
          className={cn(styles.listCardBody, isFetching && !isPending ? styles.listCardBodyFetching : undefined)}
        >
          {sortedTours.length === 0 ? (
            <EmptyState title="No results found" description={noMatchDescription(debouncedSearch, statusFilter)} />
          ) : (
            <TourList tours={sortedTours} onSelectTour={handleSelectTour} />
          )}
        </CardBody>
        {totalPages > 0 ? (
          <CardFooter>
            <div className={styles.paginationBar}>
              <span className={styles.pageIndicator}>
                Page {effectivePage} of {totalPages}
                {sortedToursFull.length > 0 ? (
                  <span>
                    {" "}
                    · {sortedToursFull.length} tour{sortedToursFull.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
              <span className={styles.sortCellInner}>
                <Button type="button" variant="secondary" disabled={effectivePage <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={effectivePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </span>
            </div>
          </CardFooter>
        ) : null}
      </Card>
    );
  }

  return <>{body}</>;
}
