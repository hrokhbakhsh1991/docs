"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  resolveInitialDenaliDestinationCatalogState,
  type DenaliDestinationCatalogState,
  type DestinationResource,
} from "../adapters/build-denali-destination-catalog-state";
import { fetchDenaliDestinationCatalogClient } from "../adapters/fetch-denali-destination-catalog";
import { countDenaliDestinationsOfferedForTourKind } from "../logic/denali-destination-picker-filter";
import { useDenaliWizardCatalogPrefetch } from "./denali-wizard-catalog-prefetch-context";

export type { DenaliDestinationCatalogState, DestinationResource };

const destinationCatalogPatchListeners = new Set<
  (destination: DestinationResource) => void
>();

export function subscribeDenaliDestinationCatalogPatch(
  listener: (destination: DestinationResource) => void
): () => void {
  destinationCatalogPatchListeners.add(listener);
  return () => {
    destinationCatalogPatchListeners.delete(listener);
  };
}

export function patchDenaliDestinationCatalogCache(destination: DestinationResource): void {
  for (const listener of destinationCatalogPatchListeners) {
    listener(destination);
  }
}

export type UseDenaliDestinationCatalogOptions = {
  readonly tourKind?: string;
};

/**
 * ED-DEST-REFETCH-01 — focus/visibility reload while HTTP-degraded **or** the current
 * tour kind has zero offered destinations (empty-after-filter is not an error).
 */
export function shouldReloadDenaliDestinationCatalogOnFocus(input: {
  readonly error: string | null;
  readonly loading: boolean;
  readonly offeredCount?: number;
}): boolean {
  if (input.loading) {
    return false;
  }
  if (input.error !== null) {
    return true;
  }
  return input.offeredCount === 0;
}

/**
 * Operator destination catalog — supports optional server prefetch via
 * {@link DenaliWizardCatalogPrefetchProvider}; otherwise fetches `/api/settings/resources/locations`.
 */
export function useDenaliDestinationCatalog(
  options?: UseDenaliDestinationCatalogOptions
): DenaliDestinationCatalogState & {
  readonly reload: () => void;
} {
  const { initialLocationsResponse } = useDenaliWizardCatalogPrefetch();
  const skipInitialFetchRef = useRef(initialLocationsResponse !== null);
  const [state, setState] = useState(() =>
    resolveInitialDenaliDestinationCatalogState(initialLocationsResponse)
  );

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true }));
    void fetchDenaliDestinationCatalogClient().then((next) => {
      setState(next);
    });
  }, []);

  useEffect(() => {
    return subscribeDenaliDestinationCatalogPatch((destination) => {
      setState((previous) => {
        const destinationById = new Map(previous.destinationById);
        destinationById.set(destination.id, destination);
        return { ...previous, destinationById };
      });
    });
  }, []);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    reload();
  }, [reload]);

  const offeredCount =
    options?.tourKind === undefined
      ? undefined
      : countDenaliDestinationsOfferedForTourKind(
          state.options.map((option) => ({
            locationType: state.destinationById.get(option.value)?.locationType,
          })),
          options.tourKind
        );

  const refetchOnFocus = shouldReloadDenaliDestinationCatalogOnFocus({
    error: state.error,
    loading: state.loading,
    offeredCount,
  });

  useEffect(() => {
    if (!refetchOnFocus) {
      return;
    }
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };
    document.addEventListener("visibilitychange", retryWhenVisible);
    window.addEventListener("focus", retryWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", retryWhenVisible);
      window.removeEventListener("focus", retryWhenVisible);
    };
  }, [refetchOnFocus, reload]);

  return { ...state, reload };
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
