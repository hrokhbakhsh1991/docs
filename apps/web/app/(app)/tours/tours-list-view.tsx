"use client";

import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useToursData } from "../../tours/_hooks/use-tours-data";
import { useToursQueryParams } from "../../tours/_hooks/use-tours-query-params";
import type { TourListQueryModel } from "../../tours/_hooks/query-model";

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
import type { TourSortColumn, TourStatusFilter } from "./tours-list-logic";
import { CREATE_TOUR_ACTION_LABEL } from "./tours-copy";

import styles from "./tours-list-view.module.css";

function toursErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "Tours could not be found.";
    }
    return error.message.trim() || "Could not load tours.";
  }
  return "Could not load tours. Check your connection and try again.";
}

function noMatchDescription(search: string, statusFilter: TourStatusFilter): string {
  const q = search.trim();
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

function uiStatusToQueryStatus(ui: TourStatusFilter): TourListQueryModel["status"] {
  switch (ui) {
    case "all":
      return "all";
    case "draft":
      return "active";
    case "active":
      return "completed";
    case "archived":
      return "archived";
    default:
      return "all";
  }
}

function queryStatusToUiStatus(s: TourListQueryModel["status"]): TourStatusFilter {
  switch (s) {
    case "all":
      return "all";
    case "active":
      return "draft";
    case "completed":
      return "active";
    case "archived":
      return "archived";
    default:
      return "all";
  }
}

export function ToursListView() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, user } = useAuth();
  const leaderToolbar =
    isHydrated && isAuthenticated && isLeaderRole(user?.role);
  const liveApi = toursUseLiveApi();
  const tourQueryEnabled = liveApi && isHydrated && isAuthenticated;

  const { query, updateQuery, searchInput, setSearchInput } = useToursQueryParams();
  const {
    tours,
    total,
    page,
    limit,
    isLoading,
    isFetching,
    error,
  } = useToursData(query, { enabled: tourQueryEnabled });

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isError = error != null;

  const statusUi = queryStatusToUiStatus(query.status);
  const listSort = query.sort;

  const searchStale = searchInput.trim() !== query.search.trim();

  const handleSelectTour = useCallback(
    (id: string) => router.push(`/tours/${encodeURIComponent(id)}`),
    [router]
  );

  const handlePrev = useCallback(() => updateQuery({ page: page - 1 }), [page, updateQuery]);

  const handleNext = useCallback(() => updateQuery({ page: page + 1 }), [page, updateQuery]);

  const onSortChange = useCallback(
    (column: string, dir: "asc" | "desc") => {
      updateQuery({ sort: { column, dir } });
    },
    [updateQuery]
  );

  const onStatusChange = useCallback(
    (status: TourListQueryModel["status"]) => {
      updateQuery({ status });
    },
    [updateQuery]
  );

  const toggleTourSort = useCallback(
    (column: TourSortColumn) => {
      const sameColumn = listSort.column === column;
      if (!sameColumn) {
        onSortChange(column, "asc");
        return;
      }
      onSortChange(column, listSort.dir === "asc" ? "desc" : "asc");
    },
    [listSort.column, listSort.dir, onSortChange]
  );

  const sortGlyphColumn =
    listSort.column === "title" || listSort.column === "price" ? listSort.column : null;

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
            embedded
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
  } else if (tourQueryEnabled && isLoading) {
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
  } else if (tourQueryEnabled && isError) {
    body = (
      <Card>
        <CardBody>
          <ErrorState title="Could not load tours" message={toursErrorMessage(error)} />
        </CardBody>
      </Card>
    );
  } else if (tours.length === 0 && query.search.trim() === "") {
    body = (
      <Card>
        <CardBody>
          <EmptyState
            embedded
            title="No tours yet"
            description={
              leaderToolbar
                ? liveApi
                  ? `When your tenant has tours, they will appear here. Create one with ${CREATE_TOUR_ACTION_LABEL} (requires API), or add tours via your workspace tools.`
                  : `Create your first tour with ${CREATE_TOUR_ACTION_LABEL}.`
                : liveApi
                  ? "When your tenant has tours, they will appear here."
                  : "No tours are listed yet."
            }
            action={
              leaderToolbar ? (
                <Button type="button" variant="primary" onClick={() => router.push("/tours/new")}>
                  {CREATE_TOUR_ACTION_LABEL}
                </Button>
              ) : undefined
            }
          />
        </CardBody>
      </Card>
    );
  } else {
    body = (
      <Card
        className={styles.listShell}
        aria-busy={isFetching && !isLoading ? true : undefined}
      >
        <CardHeader className={styles.listCardHeader}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarGrow}>
              <FormField label="Search">
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
                  value={statusUi}
                  onChange={(e) =>
                    onStatusChange(uiStatusToQueryStatus(e.target.value as TourStatusFilter))
                  }
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
              </FormField>
            </div>
          </div>
          <small className={styles.toolbarMeta}>
            Title and description (debounced 300ms).
            {searchStale ? " Updating…" : ""}
          </small>
          <div className={styles.sortBar} role="group" aria-label="Sort tours">
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="md" onClick={() => toggleTourSort("title")}>
                Sort by title
              </Button>
              {sortGlyphColumn === "title" ? (
                <span className={styles.sortDirectionGlyph} aria-hidden>
                  {listSort.dir === "asc" ? "↑" : "↓"}
                </span>
              ) : null}
            </span>
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="md" onClick={() => toggleTourSort("price")}>
                Sort by price
              </Button>
              {sortGlyphColumn === "price" ? (
                <span className={styles.sortDirectionGlyph} aria-hidden>
                  {listSort.dir === "asc" ? "↑" : "↓"}
                </span>
              ) : null}
            </span>
          </div>
        </CardHeader>
        <CardBody
          className={cn(
            styles.listCardBody,
            isFetching && !isLoading ? styles.listCardBodyFetching : undefined
          )}
        >
          {/* Skeleton only in the outer `tourQueryEnabled && isLoading` branch; keep list during refetch (keepPreviousData). */}
          {tours.length === 0 ? (
            <EmptyState embedded title="No results found" description={noMatchDescription(query.search, statusUi)} />
          ) : (
            <TourList tours={tours} onSelectTour={handleSelectTour} />
          )}
        </CardBody>
        {total > 0 ? (
          <CardFooter>
            <div className={styles.paginationBar}>
              <span className={styles.pageIndicator}>
                Page {page} of {totalPages}
                <span>
                  {" "}
                  · {total} tour{total === 1 ? "" : "s"}
                </span>
              </span>
              <span className={cn(styles.sortCellInner, styles.paginationTouchTargets)}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFetching || page <= 1}
                  onClick={handlePrev}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFetching || page >= totalPages}
                  onClick={handleNext}
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
