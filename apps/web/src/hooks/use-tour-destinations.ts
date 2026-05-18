"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { settingsLocationsKeys } from "@/lib/query-keys";

import { useWorkspaceQueryScope } from "./use-workspace-query-scope";
import {
  fetchSettingsDestinations,
  fetchSettingsRegions,
  type SettingsDestinationDto,
} from "@/lib/settings-locations-client";

export type TourDestinationGroup = {
  regionId: string;
  regionName: string;
  items: SettingsDestinationDto[];
};

/**
 * Active destinations from `/api/settings/destinations`, grouped by region for tour forms.
 */
export function useTourDestinations() {
  const tenantId = useWorkspaceQueryScope();
  const regionsQuery = useQuery({
    queryKey: settingsLocationsKeys.regions(tenantId ?? ""),
    queryFn: fetchSettingsRegions,
    enabled: Boolean(tenantId),
  });

  const destinationsQuery = useQuery({
    queryKey: settingsLocationsKeys.destinations(tenantId ?? ""),
    queryFn: fetchSettingsDestinations,
    enabled: Boolean(tenantId),
  });

  const allDestinations = destinationsQuery.data ?? [];

  const groupedRegions = useMemo((): TourDestinationGroup[] => {
    const regions = regionsQuery.data ?? [];
    const activeDestinations = allDestinations
      .filter((d) => d.isActive)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    const regionOrder = [...regions].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    );
    const byRegion = new Map<string, SettingsDestinationDto[]>();
    for (const d of activeDestinations) {
      const list = byRegion.get(d.regionId);
      if (list) {
        list.push(d);
      } else {
        byRegion.set(d.regionId, [d]);
      }
    }
    return regionOrder
      .map((r) => ({
        regionId: r.id,
        regionName: r.name,
        items: byRegion.get(r.id) ?? [],
      }))
      .filter((g) => g.items.length > 0);
  }, [allDestinations, regionsQuery.data]);

  const destinations = useMemo(
    () => allDestinations.filter((d) => d.isActive),
    [allDestinations],
  );

  return {
    groupedRegions,
    destinations,
    allDestinations,
    isLoading: regionsQuery.isLoading || destinationsQuery.isLoading,
    error: regionsQuery.error ?? destinationsQuery.error,
  };
}
