import type { SelectOption } from "@app-tour/ui-primitives/select";

import { parseLocationsResponse } from "./catalog-parse";
import type { DestinationResource, LocationsListResponse } from "./catalog-types";

export type { DestinationResource, LocationsListResponse };
export type DenaliDestinationCatalogState = {
  readonly options: readonly SelectOption[];
  readonly destinationById: ReadonlyMap<string, DestinationResource>;
  readonly loading: boolean;
  readonly error: string | null;
};

export const DENALI_DESTINATION_CATALOG_EMPTY_LOADING: DenaliDestinationCatalogState = Object.freeze({
  options: [],
  destinationById: new Map(),
  loading: true,
  error: null,
});

export function buildDenaliDestinationCatalogState(
  payload: LocationsListResponse
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

/** Parse unknown BFF/locations payload into Denali destination catalog UI state. */
export function buildDenaliDestinationCatalogStateFromPayload(
  payload: unknown
): DenaliDestinationCatalogState {
  return buildDenaliDestinationCatalogState(parseLocationsResponse(payload));
}

export function resolveInitialDenaliDestinationCatalogState(
  initialLocationsResponse: unknown | null
): DenaliDestinationCatalogState {
  if (initialLocationsResponse == null) {
    return DENALI_DESTINATION_CATALOG_EMPTY_LOADING;
  }
  try {
    return buildDenaliDestinationCatalogStateFromPayload(initialLocationsResponse);
  } catch {
    return {
      options: [],
      destinationById: new Map(),
      loading: false,
      error: "LOCATIONS_PARSE_FAILED",
    };
  }
}
