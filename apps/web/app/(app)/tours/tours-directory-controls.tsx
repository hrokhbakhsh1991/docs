"use client";

import { Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_TOUR_LIST_QUERY,
  TOURS_LIST_TEST_IDS,
  type TourListQueryModel,
} from "@/features/tours/query-model";
import {
  TOUR_CATEGORY_FILTER_ALL,
  type TourCategoryFilter,
  type TourCategoryFilterGroup,
} from "@/features/tours/tour-list-category-logic";
import {
  clearToursListAdvancedFilters,
  queryStatusToUiStatus,
  TOUR_STATUS_UI_OPTIONS,
  TOURS_LIST_SORT_OPTIONS,
  toursListAdvancedFiltersDirty,
  uiStatusToQueryStatus,
  withToursListPaginationReset,
  type TourStatusUiFilter,
} from "@/features/tours/tours-list-logic";
import {
  resolveWizardTourCategoryGroupLabel,
  resolveWizardTourKindLabel,
} from "@/wizard/wizard-label-surface-registry";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";

type ToursDirectoryControlsProps = {
  readonly pluginId: string;
  readonly query: TourListQueryModel;
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly onReplaceQuery: (next: TourListQueryModel) => void;
  readonly hasCategoryFilter: boolean;
  readonly categoryFilterGroups: readonly TourCategoryFilterGroup[];
  readonly categorySurfaceReady: boolean;
  readonly categorySurfaceFailed: boolean;
  readonly onRetryCategorySurface: () => void;
};

function encodeSortValue(sortBy: TourListQueryModel["sortBy"], sortDir: TourListQueryModel["sortDir"]): string {
  return `${sortBy}:${sortDir}`;
}

function decodeSortValue(
  value: string
): Pick<TourListQueryModel, "sortBy" | "sortDir"> | null {
  const [sortBy, sortDir] = value.split(":");
  if (
    (sortBy === "created_at" ||
      sortBy === "title" ||
      sortBy === "price" ||
      sortBy === "departure_at") &&
    (sortDir === "asc" || sortDir === "desc")
  ) {
    return { sortBy, sortDir };
  }
  return null;
}

export function ToursDirectoryControls({
  pluginId,
  query,
  searchInput,
  onSearchInputChange,
  onReplaceQuery,
  hasCategoryFilter,
  categoryFilterGroups,
  categorySurfaceReady,
  categorySurfaceFailed,
  onRetryCategorySurface,
}: ToursDirectoryControlsProps) {
  const t = useTranslations("tours");
  const tWorkspace = useWorkspaceWizardTranslator(pluginId);
  const tCommon = useTranslations("common");
  const filtersDirty = toursListAdvancedFiltersDirty(query);
  const statusUi = queryStatusToUiStatus(query.status);

  const patchQuery = (patch: Partial<TourListQueryModel>) => {
    onReplaceQuery(withToursListPaginationReset({ ...query, ...patch }));
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (query.status !== DEFAULT_TOUR_LIST_QUERY.status) {
      chips.push({
        key: "status",
        label: t("activeFilters.status", {
          value: t(`status.${statusUi}`),
        }),
        onRemove: () => patchQuery({ status: DEFAULT_TOUR_LIST_QUERY.status }),
      });
    }

    if (query.category !== TOUR_CATEGORY_FILTER_ALL) {
      chips.push({
        key: "category",
        label: t("activeFilters.category", {
          value: resolveWizardTourKindLabel(pluginId, tWorkspace, query.category),
        }),
        onRemove: () => patchQuery({ category: TOUR_CATEGORY_FILTER_ALL }),
      });
    }

    if (
      query.sortBy !== DEFAULT_TOUR_LIST_QUERY.sortBy ||
      query.sortDir !== DEFAULT_TOUR_LIST_QUERY.sortDir
    ) {
      chips.push({
        key: "sort",
        label: t("activeFilters.sort", {
          value: t(`sortOption.${encodeSortValue(query.sortBy, query.sortDir)}`),
        }),
        onRemove: () =>
          patchQuery({
            sortBy: DEFAULT_TOUR_LIST_QUERY.sortBy,
            sortDir: DEFAULT_TOUR_LIST_QUERY.sortDir,
          }),
      });
    }

    return chips;
  }, [pluginId, query, statusUi, t, tWorkspace]);

  const handleStatusChange = (nextUi: TourStatusUiFilter) => {
    patchQuery({ status: uiStatusToQueryStatus(nextUi) });
  };

  const handleCategoryChange = (next: TourCategoryFilter) => {
    patchQuery({ category: next });
  };

  const handleSortValueChange = (value: string) => {
    const decoded = decodeSortValue(value);
    if (decoded === null) {
      return;
    }
    patchQuery(decoded);
  };

  const clearAdvancedFilters = () => {
    onReplaceQuery(clearToursListAdvancedFilters(query));
  };

  return (
    <div className="space-y-3" data-testid={TOURS_LIST_TEST_IDS.controls}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 max-w-xl flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid={TOURS_LIST_TEST_IDS.search}
            className="ps-9"
            value={searchInput}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => onSearchInputChange(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                data-testid={TOURS_LIST_TEST_IDS.filtersToggle}
              >
                <Filter className="h-4 w-4" aria-hidden />
                {t("filters.toggle")}
                {filtersDirty ? (
                  <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,22rem)] space-y-4 p-4"
              data-testid={TOURS_LIST_TEST_IDS.filtersPanel}
            >
              <div className="space-y-2" data-testid={TOURS_LIST_TEST_IDS.status}>
                <Label htmlFor="tours-filter-status">{t("filters.statusLabel")}</Label>
                <select
                  id="tours-filter-status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={statusUi}
                  onChange={(event) =>
                    handleStatusChange(event.target.value as TourStatusUiFilter)
                  }
                >
                  {TOUR_STATUS_UI_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`status.${option}`)}
                    </option>
                  ))}
                </select>
              </div>

              {hasCategoryFilter ? (
                <div className="space-y-3" data-testid={TOURS_LIST_TEST_IDS.category}>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("categoryFilterLabel")}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          query.category === TOUR_CATEGORY_FILTER_ALL ? "default" : "outline"
                        }
                        onClick={() => handleCategoryChange(TOUR_CATEGORY_FILTER_ALL)}
                      >
                        {t("categoryAll")}
                      </Button>
                    </div>
                  </div>

                  {categorySurfaceReady ? (
                    categoryFilterGroups.map((group) => (
                      <div key={group.id} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {resolveWizardTourCategoryGroupLabel(pluginId, tWorkspace, group.id)}
                        </p>
                        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                          {group.slugs.map((slug) => (
                            <Button
                              key={slug}
                              type="button"
                              size="sm"
                              variant={query.category === slug ? "default" : "outline"}
                              onClick={() => handleCategoryChange(slug)}
                            >
                              {resolveWizardTourKindLabel(pluginId, tWorkspace, slug)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : categorySurfaceFailed ? (
                    <div
                      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                      data-operator-category-filters-failed
                    >
                      <span>{t("categoryFiltersUnavailable")}</span>
                      <Button type="button" size="sm" variant="outline" onClick={onRetryCategorySurface}>
                        {tCommon("retry")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground" data-operator-category-filters-pending>
                      {tCommon("loading")}
                    </p>
                  )}
                </div>
              ) : null}

              {filtersDirty ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={clearAdvancedFilters}
                >
                  {t("filters.clearAll")}
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>

          <div className="space-y-1" data-testid={TOURS_LIST_TEST_IDS.sort}>
            <Label htmlFor="tours-sort-select" className="sr-only">
              {t("sortLabel")}
            </Label>
            <select
              id="tours-sort-select"
              className="flex h-9 min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm"
              data-testid={TOURS_LIST_TEST_IDS.sortSelect}
              value={encodeSortValue(query.sortBy, query.sortDir)}
              onChange={(event) => handleSortValueChange(event.target.value)}
            >
              {TOURS_LIST_SORT_OPTIONS.flatMap((column) => {
                const directions: TourListQueryModel["sortDir"][] =
                  column === "title" ? ["asc", "desc"] : ["desc", "asc"];
                return directions.map((sortDir) => {
                  const value = encodeSortValue(column, sortDir);
                  return (
                    <option key={value} value={value}>
                      {t(`sortOption.${value}`)}
                    </option>
                  );
                });
              })}
            </select>
          </div>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid={TOURS_LIST_TEST_IDS.activeFilters}
        >
          {activeChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pe-1">
              <span>{chip.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={t("activeFilters.remove", { filter: chip.label })}
                onClick={chip.onRemove}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={clearAdvancedFilters}>
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
