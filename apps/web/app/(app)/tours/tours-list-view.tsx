"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";

import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { toursUseLiveApi } from "@/lib/services/tours.service";
import { useToursData } from "./_hooks/use-tours-data";
import { useToursQueryParams } from "./_hooks/use-tours-query-params";
import type { TourListQueryModel } from "./_hooks/query-model";

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

import styles from "./tours-list-view.module.css";

const STATUS_FILTER_OPTIONS: readonly TourStatusFilter[] = [
  "all",
  "draft",
  "active",
  "archived",
] as const;

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
  const t = useTranslations("tours.list");
  const tStatus = useTranslations("tours.status");
  const tSort = useTranslations("tours.sort");
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

  const toursErrorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          return t("errorNotFound");
        }
        return error.message.trim() || t("errorLoadGeneric");
      }
      return t("errorLoadConnection");
    },
    [t],
  );

  const noMatchDescription = useCallback(
    (search: string, statusFilter: TourStatusFilter): string => {
      const q = search.trim();
      if (q && statusFilter !== "all") {
        return t("noMatchSearchAndStatus", { query: q });
      }
      if (q) {
        return t("noMatchSearch", { query: q });
      }
      if (statusFilter !== "all") {
        return t("noMatchStatus");
      }
      return t("noMatchGeneric");
    },
    [t],
  );

  const emptyToursDescription = useMemo(() => {
    if (leaderToolbar) {
      return liveApi
        ? t("noToursDescLeaderLiveApi", { createTour: t("createTour") })
        : t("noToursDescLeader", { createTour: t("createTour") });
    }
    return liveApi ? t("noToursDescViewerLiveApi") : t("noToursDescViewer");
  }, [leaderToolbar, liveApi, t]);

  const handleSelectTour = useCallback(
    (id: string) => router.push(`/tours/${encodeURIComponent(id)}`),
    [router]
  );

  const handleDuplicateTour = useCallback(
    (tour: { id: string }) => {
      router.push(`/tours/new?clone=${encodeURIComponent(tour.id)}`);
    },
    [router],
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
          <LoadingState message={t("loadingSession")} />
        </CardBody>
      </Card>
    );
  } else if (liveApi && isHydrated && !isAuthenticated) {
    body = (
      <Card>
        <CardBody>
          <EmptyState
            embedded
            title={t("signInRequired")}
            description={t("signInRequiredDesc")}
            action={
              <Button type="button" variant="primary" onClick={() => router.push("/login")}>
                {t("signIn")}
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
          <ErrorState title={t("errorLoad")} message={toursErrorMessage(error)} />
        </CardBody>
      </Card>
    );
  } else if (tours.length === 0 && query.search.trim() === "" && query.status === "all") {
    body = (
      <Card>
        <CardBody>
          <EmptyState
            embedded
            title={t("noToursYet")}
            description={emptyToursDescription}
            action={
              leaderToolbar ? (
                <Button type="button" variant="primary" onClick={() => router.push("/tours/new")}>
                  {t("createTour")}
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
              <FormField label={t("searchLabel")}>
                <Input
                  type="search"
                  placeholder={t("searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  autoComplete="off"
                  aria-label={t("searchAriaLabel")}
                />
              </FormField>
            </div>
            <div className={styles.toolbarFixed}>
              <FormField label={t("statusFilterLabel")}>
                <Select
                  aria-label={t("statusFilterAriaLabel")}
                  value={statusUi}
                  onChange={(e) =>
                    onStatusChange(uiStatusToQueryStatus(e.target.value as TourStatusFilter))
                  }
                >
                  {STATUS_FILTER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {tStatus(value)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>
          <small className={styles.toolbarMeta}>
            {t("searchHint")}
            {searchStale ? t("searchUpdating") : ""}
          </small>
          <div className={styles.sortBar} role="group" aria-label={t("sortAriaLabel")}>
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="md" onClick={() => toggleTourSort("title")}>
                {tSort("byTitle")}
              </Button>
              {sortGlyphColumn === "title" ? (
                <span className={styles.sortDirectionGlyph} aria-hidden>
                  {listSort.dir === "asc" ? "↑" : "↓"}
                </span>
              ) : null}
            </span>
            <span className={styles.sortCellInner}>
              <Button type="button" variant="ghost" size="md" onClick={() => toggleTourSort("price")}>
                {tSort("byPrice")}
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
            <EmptyState
              embedded
              title={t("noResults")}
              description={noMatchDescription(query.search, statusUi)}
            />
          ) : (
            <TourList
              tours={tours}
              onSelectTour={handleSelectTour}
              onDuplicateTour={leaderToolbar ? handleDuplicateTour : undefined}
            />
          )}
        </CardBody>
        {total > 0 ? (
          <CardFooter>
            <div className={styles.paginationBar}>
              <span className={styles.pageIndicator}>
                {t("paginationPage", { page, totalPages })}
                <span>{t("paginationTourCount", { count: total })}</span>
              </span>
              <span className={cn(styles.sortCellInner, styles.paginationTouchTargets)}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFetching || page <= 1}
                  onClick={handlePrev}
                >
                  {t("paginationPrevious")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFetching || page >= totalPages}
                  onClick={handleNext}
                >
                  {t("paginationNext")}
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
