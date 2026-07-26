"use client";

import { useEffect, useRef, useState } from "react";

import {
  resolveInitialDenaliDestinationCatalogState,
  type DenaliDestinationCatalogState,
  type DestinationResource,
} from "../adapters/build-denali-destination-catalog-state";
import { fetchDenaliDestinationCatalogClient } from "../adapters/fetch-denali-destination-catalog";
import { useDenaliWizardCatalogPrefetch } from "./denali-wizard-catalog-prefetch-context";

export type { DenaliDestinationCatalogState, DestinationResource };

let patchDestinationCatalogCache: ((destination: DestinationResource) => void) | null = null;

export function patchDenaliDestinationCatalogCache(destination: DestinationResource): void {
  patchDestinationCatalogCache?.(destination);
}

/**
 * Operator destination catalog — supports optional server prefetch via
 * {@link DenaliWizardCatalogPrefetchProvider}; otherwise fetches `/api/settings/resources/locations`.
 */
export function useDenaliDestinationCatalog(): DenaliDestinationCatalogState {
  const { initialLocationsResponse } = useDenaliWizardCatalogPrefetch();
  const skipInitialFetchRef = useRef(initialLocationsResponse !== null);
  const [state, setState] = useState(() =>
    resolveInitialDenaliDestinationCatalogState(initialLocationsResponse)
  );

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
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    void fetchDenaliDestinationCatalogClient().then((next) => {
      if (!cancelled) {
        setState(next);
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
