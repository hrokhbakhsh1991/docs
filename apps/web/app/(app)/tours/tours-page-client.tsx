"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAppPathname, useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OperatorEmptyState } from "@/admin/patterns/operator-empty-state";
import { PageHeader } from "@/admin/patterns/page-header";
import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";
import {
  DEFAULT_TOUR_LIST_QUERY,
  parseTourListQuery,
  serializeTourListQuery,
  TOURS_LIST_TEST_IDS,
  type TourListQueryModel,
} from "@/features/tours/query-model";
import { ensureTourListCategorySurface } from "@/features/tours/tour-list-category-registry";
import { tourCategoryFilterGroupsForPlugin } from "@/features/tours/tour-list-category-logic";
import { ensureGeneratedLabelResolver } from "@/wizard/wizard-label-registry";
import { catalogListSupportsServerFilter, resolveCatalogListFeatures } from "@app-tour/workspace-sdk";
import { tourListQueryHasFilters, tourListTotalPages } from "@/features/tours/tours-list-logic";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import { ToursDirectoryControls } from "./tours-directory-controls";
import { ToursDirectoryMobileRow } from "./tours-directory-mobile-row";
import { ToursDirectoryTable } from "./tours-directory-table";
import { ToursListSkeleton, ToursListToolbarSkeleton } from "./tours-list-skeleton";

type OperatorToursPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly initialToursList?: OperatorTourListResponse | null;
};

function canManageTours(role: OperatorSessionContext["role"]): boolean {
  return role === "owner" || role === "admin";
}

export function OperatorToursPageClient({
  session,
  initialToursList = null,
}: OperatorToursPageClientProps) {
  const t = useTranslations("tours");
  const tErrors = useTranslations("tours.errors");
  const tCommon = useTranslations("common");
  const catalogListFeatures = useMemo(
    () => resolveCatalogListFeatures(session.pluginId),
    [session.pluginId]
  );
  const hasCategoryFilter = catalogListSupportsServerFilter(catalogListFeatures, "category");
  const showExtendedCard = hasCategoryFilter;
  const [categorySurfaceReady, setCategorySurfaceReady] = useState(false);
  const [categorySurfaceFailed, setCategorySurfaceFailed] = useState(false);
  const [categoryWarmNonce, setCategoryWarmNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCategorySurfaceReady(false);
    setCategorySurfaceFailed(false);
    const warmCategorySurface = async () => {
      let surface = await ensureTourListCategorySurface(session.pluginId);
      if (surface == null) {
        surface = await ensureTourListCategorySurface(session.pluginId);
      }
      await ensureGeneratedLabelResolver(session.pluginId);
      if (cancelled) {
        return;
      }
      if (surface != null) {
        setCategorySurfaceReady(true);
        setCategorySurfaceFailed(false);
        return;
      }
      setCategorySurfaceFailed(true);
    };
    void warmCategorySurface();
    return () => {
      cancelled = true;
    };
  }, [session.pluginId, categoryWarmNonce]);
  const categoryFilterGroups = useMemo(
    () =>
      hasCategoryFilter && categorySurfaceReady
        ? tourCategoryFilterGroupsForPlugin(session.pluginId)
        : [],
    [hasCategoryFilter, categorySurfaceReady, session.pluginId]
  );
  const searchParams = useAppSearchParams();
  const pathname = useAppPathname();
  const router = useRouter();
  const query = useMemo(
    () => parseTourListQuery(session.pluginId, new URLSearchParams(searchParams.toString())),
    [searchParams, session.pluginId]
  );
  const [searchInput, setSearchInput] = useState(query.search);
  const [data, setData] = useState<OperatorTourListResponse | null>(initialToursList);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialToursList === null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const skipInitialFetchRef = useRef(initialToursList !== null);
  const capturedCreatedNoticeRef = useRef(false);
  const [createdNoticeTourId, setCreatedNoticeTourId] = useState<string | null>(null);

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
    const createdId = searchParams.get("created")?.trim() ?? "";
    if (createdId.length === 0) {
      return;
    }
    if (!capturedCreatedNoticeRef.current) {
      capturedCreatedNoticeRef.current = true;
      setCreatedNoticeTourId(createdId);
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete("created");
    const suffix = next.toString();
    router.replace(suffix.length > 0 ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }

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
  const totalPages = data ? tourListTotalPages(data.total, data.limit) : 1;
  const hasFilters = tourListQueryHasFilters(query);
  const items = data?.items ?? [];
  const isInitialLoad = loading && data === null;
  const isRefetching = loading && data !== null;
  const showEmptyCatalog = !loading && !error && items.length === 0 && !hasFilters;
  const showEmptyFilter = !loading && !error && items.length === 0 && hasFilters;

  return (
    <div className="space-y-6" data-testid={TOURS_LIST_TEST_IDS.page}>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageSubtitle")}
        actions={
          showCreate ? (
            <Button asChild className="w-full gap-2 sm:w-auto">
              <TourInternalLink href={OPERATOR_WIZARD_PATH}>
                <Plus className="h-4 w-4" />
                {t("newTour")}
              </TourInternalLink>
            </Button>
          ) : null
        }
      />

      {createdNoticeTourId !== null ? (
        <p
          className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
          role="status"
          data-testid={TOURS_LIST_TEST_IDS.createdNotice}
        >
          {t("createdNotice")}
        </p>
      ) : null}

      {isInitialLoad ? (
        <ToursListToolbarSkeleton />
      ) : (
        <ToursDirectoryControls
          pluginId={session.pluginId}
          query={query}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onReplaceQuery={replaceQuery}
          hasCategoryFilter={hasCategoryFilter}
          categoryFilterGroups={categoryFilterGroups}
          categorySurfaceReady={categorySurfaceReady}
          categorySurfaceFailed={categorySurfaceFailed}
          onRetryCategorySurface={() => setCategoryWarmNonce((n) => n + 1)}
        />
      )}

      {isInitialLoad ? <ToursListSkeleton /> : null}

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
            <OperatorEmptyState
              description={t("emptyCatalog")}
              action={
                showCreate ? (
                  <Button asChild className="gap-2">
                    <TourInternalLink href={OPERATOR_WIZARD_PATH}>
                      <Plus className="h-4 w-4" />
                      {t("newTour")}
                    </TourInternalLink>
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
            <OperatorEmptyState description={t("emptyFilter")} icon="map" />
          </CardContent>
        </Card>
      ) : null}

      {!isInitialLoad && !error && items.length > 0 ? (
        <div
          className={`space-y-4${isRefetching ? " opacity-60" : ""}`}
          data-testid={TOURS_LIST_TEST_IDS.list}
          aria-busy={isRefetching ? true : undefined}
        >
          <ToursDirectoryTable
            pluginId={session.pluginId}
            tours={items}
            canManage={showCreate}
            showExtendedMeta={showExtendedCard}
          />
          <ul className="grid grid-cols-1 gap-3 lg:hidden" data-testid={TOURS_LIST_TEST_IDS.tableMobile}>
            {items.map((tour) => (
              <li key={tour.id}>
                <ToursDirectoryMobileRow
                  pluginId={session.pluginId}
                  tour={tour}
                  canManage={showCreate}
                  showExtendedMeta={showExtendedCard}
                />
              </li>
            ))}
          </ul>
        </div>
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
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
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
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
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
