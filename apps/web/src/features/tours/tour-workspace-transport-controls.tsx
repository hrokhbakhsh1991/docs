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
  OPERATIONAL_ROSTER_FILTERS,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  type OperationalRosterFilter,
} from "@/features/tours/tour-workspace-transport-logic";

type TourWorkspaceTransportControlsProps = {
  readonly filter: OperationalRosterFilter;
  readonly onFilterChange: (filter: OperationalRosterFilter) => void;
};

export function TourWorkspaceTransportControls({
  filter,
  onFilterChange,
}: TourWorkspaceTransportControlsProps) {
  const t = useTranslations("tours.workspace.transport");
  const tControls = useTranslations("tours.workspace.controls");

  const filtersDirty = filter !== "operational";

  const activeChips = useMemo((): readonly OperatorDirectoryFilterChip[] => {
    if (filter === "operational") {
      return [];
    }
    return [
      {
        key: "roster",
        label: tControls("activeFilters.roster", { value: t(`filters.${filter}`) }),
        onRemove: () => onFilterChange("operational"),
      },
    ];
  }, [filter, onFilterChange, t, tControls]);

  return (
    <OperatorDirectoryFilterChrome
      testId={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.controls}
      filtersToggleTestId={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filtersToggle}
      filtersPanelTestId={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filtersPanel}
      activeFiltersTestId={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.activeFilters}
      filtersDirty={filtersDirty}
      filtersToggleLabel={tControls("filtersToggle")}
      clearAllLabel={tControls("clearAll")}
      removeFilterAriaLabel={(label) => tControls("removeFilter", { filter: label })}
      activeChips={activeChips}
      onClearAll={filtersDirty ? () => onFilterChange("operational") : undefined}
      filterPanel={
        <>
          <div className="space-y-2" data-testid={TOUR_WORKSPACE_TRANSPORT_TEST_IDS.filters}>
            <Label htmlFor="tour-workspace-transport-roster-filter">
              {tControls("rosterFilterLabel")}
            </Label>
            <select
              id="tour-workspace-transport-roster-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filter}
              onChange={(event) =>
                onFilterChange(event.target.value as OperationalRosterFilter)
              }
            >
              {OPERATIONAL_ROSTER_FILTERS.map((filterId) => (
                <option key={filterId} value={filterId}>
                  {t(`filters.${filterId}`)}
                </option>
              ))}
            </select>
          </div>
          {filtersDirty ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => onFilterChange("operational")}
            >
              {tControls("clearAll")}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
