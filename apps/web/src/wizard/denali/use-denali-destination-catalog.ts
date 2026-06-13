"use client";

import { useEffect, useRef, useState } from "react";
import type { SelectOption } from "@app-tour/ui-primitives/select";

import type { DestinationResource } from "@/features/settings/settings-module-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";

import { useDenaliWizardCatalogPrefetch } from "./denali-wizard-catalog-prefetch-context";

export type DenaliDestinationCatalogState = {
  readonly options: readonly SelectOption[];
  readonly destinationById: ReadonlyMap<string, DestinationResource>;
  readonly loading: boolean;
  readonly error: string | null;
};

const EMPTY_LOADING_STATE: DenaliDestinationCatalogState = {
  options: [],
  destinationById: new Map(),
  loading: true,
  error: null,
};

function buildDestinationCatalogState(payload: ReturnType<typeof parseLocationsResponse>): DenaliDestinationCatalogState {
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

function resolveInitialDestinationCatalogState(
  initialLocationsResponse: unknown | null
): DenaliDestinationCatalogState {
  if (initialLocationsResponse == null) {
    return EMPTY_LOADING_STATE;
  }
  try {
    return buildDestinationCatalogState(parseLocationsResponse(initialLocationsResponse));
  } catch {
    return {
      options: [],
      destinationById: new Map(),
      loading: false,
      error: "LOCATIONS_PARSE_FAILED",
    };
  }
}

export function useDenaliDestinationCatalog(): DenaliDestinationCatalogState {
  const { initialLocationsResponse } = useDenaliWizardCatalogPrefetch();
  const skipInitialFetchRef = useRef(initialLocationsResponse !== null);
  const [state, setState] = useState(() => resolveInitialDestinationCatalogState(initialLocationsResponse));

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
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
