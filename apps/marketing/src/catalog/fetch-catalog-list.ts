import type { CatalogListFilters } from "./catalog-list-query";
import { buildCatalogListFetchQuery } from "./build-catalog-list-fetch-query";
import { catalogListHasNarrowingFilters } from "./catalog-list-query";
import type { MarketingCatalogListResponse, MarketingCatalogListResult } from "./catalog-types";
import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
} from "./catalog-fetch-options";
import { resolveCatalogListApiPath } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "../env";

export async function fetchCatalogList(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly city?: string;
  readonly filters?: CatalogListFilters;
}): Promise<MarketingCatalogListResult> {
  const path = resolveCatalogListApiPath(input.pluginId);
  const query = buildCatalogListFetchQuery(input);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const bypassCache =
    resolveCatalogFetchCache() === "no-store" ||
    (input.filters != null &&
      (catalogListHasNarrowingFilters(input.filters) || input.filters.sort !== "newest"));

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}${suffix}`, {
    method: "GET",
    headers: { "x-tenant-id": input.tenantId },
    cache: bypassCache ? "no-store" : resolveCatalogFetchCache(),
    next: bypassCache ? undefined : resolveCatalogFetchNext(input.tenantId),
  });
  if (!res.ok) {
    throw new Error(`MARKETING_CATALOG_FETCH_FAILED:${res.status}`);
  }
  const body = (await res.json()) as MarketingCatalogListResponse;
  return {
    items: body.data?.items ?? [],
    nextCursor: body.metadata?.nextCursor ?? null,
  };
}
