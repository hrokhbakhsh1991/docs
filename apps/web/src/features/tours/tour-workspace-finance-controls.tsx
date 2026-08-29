"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  OperatorDirectoryFilterChrome,
  type OperatorDirectoryFilterChip,
} from "@/admin/patterns/operator-directory-filter-chrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  TOUR_WORKSPACE_FINANCE_TEST_IDS,
  type TourFinanceListFilter,
} from "@/features/tours/tour-workspace-finance-logic";

const FINANCE_LIST_FILTERS: readonly TourFinanceListFilter[] = ["all", "unpaid", "partial"];

type TourWorkspaceFinanceControlsProps = {
  readonly listFilter: TourFinanceListFilter;
  readonly searchQuery: string;
  readonly onListFilterChange: (filter: TourFinanceListFilter) => void;
  readonly onSearchQueryChange: (value: string) => void;
};

export function TourWorkspaceFinanceControls({
  listFilter,
  searchQuery,
  onListFilterChange,
  onSearchQueryChange,
}: TourWorkspaceFinanceControlsProps) {
  const t = useTranslations("tours.workspace.finance");
  const tControls = useTranslations("tours.workspace.controls");

  const filtersDirty = listFilter !== "all";

  const activeChips = useMemo((): readonly OperatorDirectoryFilterChip[] => {
    const chips: OperatorDirectoryFilterChip[] = [];
    if (listFilter !== "all") {
      chips.push({
        key: "payment",
        label: tControls("activeFilters.payment", { value: t(`filter.${listFilter}`) }),
        onRemove: () => onListFilterChange("all"),
      });
    }
    if (searchQuery.trim().length > 0) {
      chips.push({
        key: "search",
        label: tControls("activeFilters.search", { value: searchQuery.trim() }),
        onRemove: () => onSearchQueryChange(""),
      });
    }
    return chips;
  }, [listFilter, onListFilterChange, onSearchQueryChange, searchQuery, t, tControls]);

  const clearAll = () => {
    onListFilterChange("all");
    onSearchQueryChange("");
  };

  return (
    <OperatorDirectoryFilterChrome
      testId={TOUR_WORKSPACE_FINANCE_TEST_IDS.controls}
      searchTestId={TOUR_WORKSPACE_FINANCE_TEST_IDS.search}
      filtersToggleTestId={TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersToggle}
      filtersPanelTestId={TOUR_WORKSPACE_FINANCE_TEST_IDS.filtersPanel}
      activeFiltersTestId={TOUR_WORKSPACE_FINANCE_TEST_IDS.activeFilters}
      searchValue={searchQuery}
      searchPlaceholder={t("searchPlaceholder")}
      onSearchChange={onSearchQueryChange}
      filtersDirty={filtersDirty}
      filtersToggleLabel={tControls("filtersToggle")}
      clearAllLabel={tControls("clearAll")}
      removeFilterAriaLabel={(filter) => tControls("removeFilter", { filter })}
      activeChips={activeChips}
      onClearAll={activeChips.length > 0 ? clearAll : undefined}
      filterPanel={
        <>
          <div className="space-y-2" data-testid={TOUR_WORKSPACE_FINANCE_TEST_IDS.filters}>
            <Label htmlFor="tour-workspace-finance-payment-filter">
              {tControls("paymentFilterLabel")}
            </Label>
            <select
              id="tour-workspace-finance-payment-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={listFilter}
              onChange={(event) =>
                onListFilterChange(event.target.value as TourFinanceListFilter)
              }
            >
              {FINANCE_LIST_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {t(`filter.${filter}`)}
                </option>
              ))}
            </select>
          </div>
          {filtersDirty ? (
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={clearAll}>
              {tControls("clearAll")}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
