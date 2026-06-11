"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DenaliEmptyState } from "@/admin/patterns/denali-empty-state";
import { DenaliSkeleton } from "@/admin/patterns/denali-skeleton";
import { PageHeader } from "@/admin/patterns/page-header";
import { resolveDenaliTourKindLabel } from "@/i18n/denali-wizard-labels";
import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";
import {
  DEFAULT_TOUR_LIST_QUERY,
  parseTourListQuery,
  serializeTourListQuery,
  TOURS_LIST_TEST_IDS,
  type TourListQueryModel,
} from "@/features/tours/query-model";
import {
  TOUR_CATEGORY_FILTER_ALL,
  TOUR_CATEGORY_FILTER_OPTIONS,
  type TourCategoryFilter,
} from "@/features/tours/tour-list-category-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  queryStatusToUiStatus,
  TOUR_STATUS_UI_OPTIONS,
  tourListQueryHasFilters,
  tourListTotalPages,
  uiStatusToQueryStatus,
  type TourStatusUiFilter,
} from "@/features/tours/tours-list-logic";

import { TourCard } from "./tour-card";

type OperatorToursPageClientProps = {
  readonly session: OperatorSessionContext;
};

function canManageTours(role: OperatorSessionContext["role"]): boolean {
  return role === "owner" || role === "admin";
}

const SORT_COLUMNS: readonly TourListQueryModel["sortBy"][] = [
  "created_at",
  "title",
  "price",
] as const;

export function OperatorToursPageClient({ session }: OperatorToursPageClientProps) {
  const t = useTranslations("tours");
  const tDenali = useTranslations("denali");
  const tErrors = useTranslations("tours.errors");
  const tCommon = useTranslations("common");
  const isDenali = session.pluginId === "denali";
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = useMemo(
    () => parseTourListQuery(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );
  const [searchInput, setSearchInput] = useState(query.search);
  const [data, setData] = useState<OperatorTourListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchNonce, setFetchNonce] = useState(0);

  const replaceQuery = useCallback(
    (next: TourListQueryModel) => {
      router.replace(`${pathname}?${serializeTourListQuery(next)}`);
    },
    [pathname, router]
  );

  useEffect(() => {
    setSearchInput(query.search);
  }, [query.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === query.search) {
        return;
      }
      replaceQuery({ ...query, search: searchInput, page: 1 });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, replaceQuery, searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/tours?${serializeTourListQuery(query)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`TOURS_LIST_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorTourListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "TOURS_LIST_FAILED");
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
  }, [query, fetchNonce]);

  const showCreate = canManageTours(session.role);
  const statusUi = queryStatusToUiStatus(query.status);
  const totalPages = data ? tourListTotalPages(data.total, data.limit) : 1;
  const hasFilters = tourListQueryHasFilters(query);
  const items = data?.items ?? [];
  const showEmptyCatalog = !loading && !error && items.length === 0 && !hasFilters;
  const showEmptyFilter = !loading && !error && items.length === 0 && hasFilters;

  const handleStatusChange = (nextUi: TourStatusUiFilter) => {
    replaceQuery({
      ...query,
      status: uiStatusToQueryStatus(nextUi),
      page: 1,
    });
  };

  const handleCategoryChange = (next: TourCategoryFilter) => {
    replaceQuery({
      ...query,
      category: next,
      page: 1,
    });
  };

  const handleSortChange = (column: TourListQueryModel["sortBy"]) => {
    if (query.sortBy === column) {
      replaceQuery({
        ...query,
        sortDir: query.sortDir === "asc" ? "desc" : "asc",
        page: 1,
      });
      return;
    }
    replaceQuery({
      ...query,
      sortBy: column,
      sortDir: column === "title" ? "asc" : "desc",
      page: 1,
    });
  };

  return (
    <div className="space-y-6" data-testid={TOURS_LIST_TEST_IDS.page}>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          showCreate ? (
            <Link href={OPERATOR_WIZARD_PATH}>
              <Button className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                {t("newTour")}
              </Button>
            </Link>
          ) : null
        }
      />

      {loading ? (
        <div className="space-y-3">
          <DenaliSkeleton className="h-10 w-full max-w-xl rounded-md" />
          <div className="flex flex-wrap gap-2">
            <DenaliSkeleton className="h-9 w-16 rounded-md" />
            <DenaliSkeleton className="h-9 w-20 rounded-md" />
            <DenaliSkeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid={TOURS_LIST_TEST_IDS.search}
              className="ps-9"
              value={searchInput}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            data-testid={TOURS_LIST_TEST_IDS.status}
          >
            <div className="flex flex-wrap gap-2">
              {TOUR_STATUS_UI_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={statusUi === option ? "default" : "outline"}
                  onClick={() => handleStatusChange(option)}
                >
                  {t(`status.${option}`)}
                </Button>
              ))}
            </div>
          </div>

          {isDenali ? (
            <div
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
              data-testid={TOURS_LIST_TEST_IDS.category}
            >
              <span className="text-sm text-muted-foreground">{t("categoryFilterLabel")}</span>
              <div className="flex flex-wrap gap-2">
                {TOUR_CATEGORY_FILTER_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={query.category === option ? "default" : "outline"}
                    onClick={() => handleCategoryChange(option)}
                  >
                    {option === TOUR_CATEGORY_FILTER_ALL
                      ? t("categoryAll")
                      : resolveDenaliTourKindLabel(tDenali, option)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2" data-testid={TOURS_LIST_TEST_IDS.sort}>
            <span className="text-sm text-muted-foreground">{t("sortLabel")}</span>
            {SORT_COLUMNS.map((column) => {
              const active = query.sortBy === column;
              const dir = active ? query.sortDir : null;
              return (
                <Button
                  key={column}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  onClick={() => handleSortChange(column)}
                >
                  {t(`sort.${column}`)}
                  {dir ? ` (${dir})` : ""}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <DenaliSkeleton key={index} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"
        >
          <p>{resolveCodedErrorMessage(tErrors, error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            data-testid={TOURS_LIST_TEST_IDS.retry}
            onClick={() => setFetchNonce((value) => value + 1)}
          >
            {tCommon("retry")}
          </Button>
        </div>
      ) : null}

      {showEmptyCatalog ? (
        <Card data-testid={TOURS_LIST_TEST_IDS.emptyCatalog}>
          <CardContent className="py-6">
            <DenaliEmptyState
              description={t("emptyCatalog")}
              action={
                showCreate ? (
                  <Button asChild className="gap-2">
                    <Link href={OPERATOR_WIZARD_PATH}>
                      <Plus className="h-4 w-4" />
                      {t("newTour")}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {showEmptyFilter ? (
        <Card data-testid={TOURS_LIST_TEST_IDS.empty}>
          <CardContent className="py-6">
            <DenaliEmptyState description={t("emptyFilter")} icon="map" />
          </CardContent>
        </Card>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid={TOURS_LIST_TEST_IDS.list}
        >
          {items.map((tour) => (
            <li key={tour.id}>
              <TourCard tour={tour} canManage={showCreate} />
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.total > 0 ? (
        <div
          className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid={TOURS_LIST_TEST_IDS.pagination}
        >
          <p className="text-sm text-muted-foreground">
            {t("pagination", { page: data.page, totalPages, total: data.total })}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => replaceQuery({ ...query, page: Math.max(1, data.page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
              {tCommon("previous")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= totalPages}
              onClick={() => replaceQuery({ ...query, page: data.page + 1 })}
            >
              {tCommon("next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function buildDefaultTourListQueryForTests(): TourListQueryModel {
  return DEFAULT_TOUR_LIST_QUERY;
}
