import type { SelectOption } from "@app-tour/ui-primitives/select";

import {
  buildDenaliDestinationCatalogStateFromPayload,
  type DenaliDestinationCatalogState,
} from "./build-denali-destination-catalog-state";
import { fetchDenaliCatalogJsonWithSoftRetry } from "./catalog-soft-fail";

let inflightCatalogRequest: Promise<DenaliDestinationCatalogState> | null = null;

/**
 * Deduped operator BFF fetch — `/api/settings/resources/locations`
 * (one in-flight request; shared by package hook + web shim). Soft-retries once on 5xx/network.
 */
export function fetchDenaliDestinationCatalogClient(
  fetchImpl: typeof fetch = fetch
): Promise<DenaliDestinationCatalogState> {
  if (inflightCatalogRequest !== null) {
    return inflightCatalogRequest;
  }

  inflightCatalogRequest = fetchDenaliCatalogJsonWithSoftRetry<unknown>(
    "/api/settings/resources/locations",
    "LOCATIONS",
    fetchImpl
  )
    .then((payload) => buildDenaliDestinationCatalogStateFromPayload(payload))
    .catch((fetchError: unknown) => ({
      options: [] as readonly SelectOption[],
      destinationById: new Map(),
      loading: false,
      error: fetchError instanceof Error ? fetchError.message : "LOCATIONS_LOAD_FAILED",
    }))
    .finally(() => {
      inflightCatalogRequest = null;
    });

  return inflightCatalogRequest;
}
