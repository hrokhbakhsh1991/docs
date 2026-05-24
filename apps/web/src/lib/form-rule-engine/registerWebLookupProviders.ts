import type { LookupRegistry } from "@repo/shared";

import {
  fetchSettingsDestinations,
  type SettingsDestinationDto,
} from "@/lib/settings-locations-client";

import { LOOKUP_PROVIDER_IDS } from "./lookupProviderIds";

export type DestinationSearchItem = Pick<SettingsDestinationDto, "id" | "name" | "regionId">;

/**
 * Registers web catalog lookup providers (settings API).
 * Safe to call multiple times only if using a fresh registry each time.
 */
export function registerWebLookupProviders(registry: LookupRegistry): void {
  registry.register<DestinationSearchItem>(LOOKUP_PROVIDER_IDS.destinationSearch, async (query) => {
    const destinations = await fetchSettingsDestinations();
    const regionId = query.dependencyValues["basicInfo.regionId"];
    const tourType = query.dependencyValues["basicInfo.tourType"];
    const q = query.searchText.trim().toLowerCase();

    let items: DestinationSearchItem[] = destinations
      .filter((row) => row.isActive)
      .map((row) => ({ id: row.id, name: row.name, regionId: row.regionId }));

    if (typeof regionId === "string" && regionId.trim() !== "") {
      items = items.filter((row) => row.regionId === regionId);
    }

    if (typeof tourType === "string" && tourType.startsWith("event_")) {
      items = [];
    }

    if (q !== "") {
      items = items.filter((row) => row.name.toLowerCase().includes(q));
    }

    return { items };
  });
}
