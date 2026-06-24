"use client";

import { useEffect, useState } from "react";

import { parseLocationsResponse } from "../adapters/catalog-parse";
import type { DestinationResource } from "../adapters/catalog-types";
import type { SelectOption } from "../adapters/platform-primitives";

export type DenaliDestinationCatalogState = {
  readonly options: readonly SelectOption[];
  readonly destinationById: ReadonlyMap<string, DestinationResource>;
  readonly loading: boolean;
  readonly error: string | null;
};

const EMPTY_STATE: DenaliDestinationCatalogState = {
  options: [],
  destinationById: new Map(),
  loading: true,
  error: null,
};

let patchDestinationCatalogCache: ((destination: DestinationResource) => void) | null = null;

export function patchDenaliDestinationCatalogCache(destination: DestinationResource): void {
  patchDestinationCatalogCache?.(destination);
}

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

export function useDenaliDestinationCatalog(): DenaliDestinationCatalogState {
  const [state, setState] = useState<DenaliDestinationCatalogState>(EMPTY_STATE);

  useEffect(() => {
    patchDestinationCatalogCache = (destination) => {
      setState((previous) => {
        const destinationById = new Map(previous.destinationById);
        destinationById.set(destination.id, destination);
        return { ...previous, destinationById };
      });
    };
    return () => {
      patchDestinationCatalogCache = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/resources/locations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LOCATIONS_HTTP_${response.status}`);
        }
        return parseLocationsResponse(await response.json());
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setState(buildDestinationCatalogState(payload));
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setState({
            options: [],
            destinationById: new Map(),
            loading: false,
            error: fetchError instanceof Error ? fetchError.message : "LOCATIONS_LOAD_FAILED",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function readDenaliDestinationLabel(
  destinationId: string | undefined,
  destinationById: ReadonlyMap<string, DestinationResource>
): string | undefined {
  if (destinationId == null || destinationId.trim().length === 0) {
    return undefined;
  }
  const name = destinationById.get(destinationId)?.name?.trim();
  return name != null && name.length > 0 ? name : undefined;
}
