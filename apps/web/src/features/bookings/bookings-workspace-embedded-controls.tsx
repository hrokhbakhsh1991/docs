"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  OperatorDirectoryFilterChrome,
  type OperatorDirectoryFilterChip,
} from "@/admin/patterns/operator-directory-filter-chrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@app-tour/ui-primitives/select";
import {
  bookingsAdvancedFiltersDirty,
  clearBookingsCommandCenterFilters,
} from "@/features/bookings/bookings-command-center-logic";
import {
  BOOKINGS_COMMAND_CENTER_TEST_IDS,
  BOOKINGS_LIST_SORT_OPTIONS,
  BOOKING_STATUS_FILTER_OPTIONS,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  PAYMENT_STATUS_FILTER_OPTIONS,
  type BookingsCommandCenterQuery,
  type BookingsListSort,
} from "@/features/bookings/bookings-command-center-types";

type BookingsWorkspaceEmbeddedControlsProps = {
  readonly query: BookingsCommandCenterQuery;
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly onReplaceQuery: (next: BookingsCommandCenterQuery) => void;
  readonly showStatusFilter?: boolean;
};

export function BookingsWorkspaceEmbeddedControls({
  query,
  searchInput,
  onSearchInputChange,
  onReplaceQuery,
  showStatusFilter = true,
}: BookingsWorkspaceEmbeddedControlsProps) {
  const t = useTranslations("bookings");
  const tControls = useTranslations("tours.workspace.controls");
  const filtersDirty = bookingsAdvancedFiltersDirty(query);

  const patchQuery = (patch: Partial<BookingsCommandCenterQuery>) => {
    onReplaceQuery({ ...query, ...patch });
  };

  const activeChips = useMemo((): readonly OperatorDirectoryFilterChip[] => {
    const chips: OperatorDirectoryFilterChip[] = [];

    if (showStatusFilter && query.status !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status) {
      chips.push({
        key: "status",
        label: tControls("activeFilters.status", { value: t(`status.${query.status}`) }),
        onRemove: () => patchQuery({ status: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status }),
      });
    }
    if (query.paymentStatus !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus) {
      chips.push({
        key: "payment",
        label: tControls("activeFilters.payment", {
          value: t(`payment.${query.paymentStatus}`),
        }),
        onRemove: () =>
          patchQuery({ paymentStatus: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus }),
      });
    }
    if (query.sort !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort) {
      chips.push({
        key: "sort",
        label: tControls("activeFilters.sort", { value: t(`sort.${query.sort}`) }),
        onRemove: () => patchQuery({ sort: DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort }),
      });
    }
    if (query.search.length > 0) {
      chips.push({
        key: "search",
        label: tControls("activeFilters.search", { value: query.search }),
        onRemove: () => {
          onSearchInputChange("");
          patchQuery({ search: "" });
        },
      });
    }

    return chips;
  }, [onSearchInputChange, patchQuery, query, showStatusFilter, t, tControls]);

  const clearAll = () => {
    onSearchInputChange("");
    onReplaceQuery(clearBookingsCommandCenterFilters(query));
  };

  return (
    <OperatorDirectoryFilterChrome
      testId={BOOKINGS_COMMAND_CENTER_TEST_IDS.workspaceControls}
      searchTestId={BOOKINGS_COMMAND_CENTER_TEST_IDS.search}
      filtersToggleTestId={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersToggle}
      filtersPanelTestId={BOOKINGS_COMMAND_CENTER_TEST_IDS.filtersPanel}
      activeFiltersTestId={BOOKINGS_COMMAND_CENTER_TEST_IDS.activeFilters}
      searchValue={searchInput}
      searchPlaceholder={t("searchPlaceholder")}
      onSearchChange={onSearchInputChange}
      filtersDirty={filtersDirty}
      filtersToggleLabel={tControls("filtersToggle")}
      clearAllLabel={tControls("clearAll")}
      removeFilterAriaLabel={(filter) => tControls("removeFilter", { filter })}
      activeChips={activeChips}
      onClearAll={activeChips.length > 0 ? clearAll : undefined}
      filterPanel={
        <>
          {showStatusFilter ? (
            <div className="space-y-2">
              <Label htmlFor="bookings-workspace-status-filter">
                {tControls("statusFilterLabel")}
              </Label>
              <Select
                id="bookings-workspace-status-filter"
                className="h-10 w-full"
                options={BOOKING_STATUS_FILTER_OPTIONS.map((status) => ({
                  value: status,
                  label: t(`status.${status}`),
                }))}
                value={query.status}
                onChange={(event) =>
                  patchQuery({
                    status: event.target.value as BookingsCommandCenterQuery["status"],
                    approvedWithinDays: "",
                  })
                }
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="bookings-workspace-payment-filter">
              {tControls("paymentFilterLabel")}
            </Label>
            <Select
              id="bookings-workspace-payment-filter"
              className="h-10 w-full"
              options={PAYMENT_STATUS_FILTER_OPTIONS.map((paymentStatus) => ({
                value: paymentStatus,
                label: t(`payment.${paymentStatus}`),
              }))}
              value={query.paymentStatus}
              onChange={(event) =>
                patchQuery({
                  paymentStatus: event.target.value as BookingsCommandCenterQuery["paymentStatus"],
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bookings-workspace-sort-filter">{tControls("sortFilterLabel")}</Label>
            <Select
              id="bookings-workspace-sort-filter"
              className="h-10 w-full"
              options={BOOKINGS_LIST_SORT_OPTIONS.map((sort) => ({
                value: sort,
                label: t(`sort.${sort}`),
              }))}
              data-testid={BOOKINGS_COMMAND_CENTER_TEST_IDS.sortSelect}
              value={query.sort}
              onChange={(event) => patchQuery({ sort: event.target.value as BookingsListSort })}
            />
          </div>

          {filtersDirty || activeChips.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={clearAll}>
              {tControls("clearAll")}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
