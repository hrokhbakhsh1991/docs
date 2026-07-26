import type { SelectOption } from "@app-tour/ui-primitives/select";

import {
  buildDenaliDestinationCatalogStateFromPayload,
  type DenaliDestinationCatalogState,
} from "./build-denali-destination-catalog-state";

let inflightCatalogRequest: Promise<DenaliDestinationCatalogState> | null = null;

/**
 * Deduped operator BFF fetch — `/api/settings/resources/locations`
 * (one in-flight request; shared by package hook + web shim).
 */
export function fetchDenaliDestinationCatalogClient(
  fetchImpl: typeof fetch = fetch
): Promise<DenaliDestinationCatalogState> {
  if (inflightCatalogRequest !== null) {
    return inflightCatalogRequest;
  }

  inflightCatalogRequest = fetchImpl("/api/settings/resources/locations", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`LOCATIONS_HTTP_${response.status}`);
      }
      return buildDenaliDestinationCatalogStateFromPayload(await response.json());
    })
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
