import type { CatalogListFilters } from "./catalog-list-query";
import { buildCatalogListFetchQuery } from "./build-catalog-list-fetch-query";
import type { MarketingCatalogListResponse, MarketingCatalogListResult } from "./catalog-types";
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
  const res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}${suffix}`, {
    method: "GET",
    headers: { "x-tenant-id": input.tenantId },
    // registrationState/spotsRemaining are booking-backed and must agree with PDP.
    cache: "no-store",
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
