import type { SelectOption } from "@app-tour/ui-primitives/select";

import type { DestinationResource } from "@/features/settings/settings-module-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";

export type DenaliDestinationCatalogState = {
  readonly options: readonly SelectOption[];
  readonly destinationById: ReadonlyMap<string, DestinationResource>;
  readonly loading: boolean;
  readonly error: string | null;
};

let inflightCatalogRequest: Promise<DenaliDestinationCatalogState> | null = null;

function buildDestinationCatalogState(
  payload: ReturnType<typeof parseLocationsResponse>
): DenaliDestinationCatalogState {
  const regionById = new Map(payload.regions.map((region) => [region.id, region.name]));
  const byId = new Map(payload.destinations.map((destination) => [destination.id, destination]));
  return {
    options: payload.destinations
      .filter((destination) => destination.isActive)
      .map((destination) => {
        const regionName = regionById.get(destination.regionId);
        const suffix = regionName ? ` (${regionName})` : "";
        return {
          value: destination.id,
          label: `${destination.name}${suffix}`,
        };
      }),
    destinationById: byId,
    loading: false,
    error: null,
  };
}

/** Deduped client fetch — one in-flight request per page load (wizard + flat edit). */
export function fetchDenaliDestinationCatalogClient(): Promise<DenaliDestinationCatalogState> {
  if (inflightCatalogRequest !== null) {
    return inflightCatalogRequest;
  }

  inflightCatalogRequest = fetch("/api/settings/resources/locations", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`LOCATIONS_HTTP_${response.status}`);
      }
      return buildDestinationCatalogState(parseLocationsResponse(await response.json()));
    })
    .catch((fetchError: unknown) => ({
      options: [],
      destinationById: new Map(),
      loading: false,
      error: fetchError instanceof Error ? fetchError.message : "LOCATIONS_LOAD_FAILED",
    }))
    .finally(() => {
      inflightCatalogRequest = null;
    });

  return inflightCatalogRequest;
}
