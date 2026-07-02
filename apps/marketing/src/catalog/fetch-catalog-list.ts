import type { MarketingCatalogListResponse, MarketingCatalogListResult } from "./catalog-types";
import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
} from "./catalog-fetch-options";
import { resolveCatalogListApiPath, resolveCatalogListFeatures } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "../env";

export async function fetchCatalogList(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly city?: string;
}): Promise<MarketingCatalogListResult> {
  const path = resolveCatalogListApiPath(input.pluginId);
  const query = new URLSearchParams();
  if (input.cursor !== undefined && input.cursor.trim().length > 0) {
    query.set("cursor", input.cursor.trim());
  }
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (
    resolveCatalogListFeatures(input.pluginId).cityFilter &&
    input.city !== undefined &&
    input.city.trim().length > 0
  ) {
    query.set("city", input.city.trim());
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}${suffix}`, {
    method: "GET",
    headers: { "x-tenant-id": input.tenantId },
    cache: resolveCatalogFetchCache(),
    next: resolveCatalogFetchNext(input.tenantId),
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
