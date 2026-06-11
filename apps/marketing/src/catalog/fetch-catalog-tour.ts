import { resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "./catalog-types";
import {
  resolveCatalogFetchCache,
  resolveCatalogFetchNext,
} from "./catalog-fetch-options";
import { resolveTourOpsApiBaseUrl } from "../env";

type MarketingCatalogDetailResponse = {
  readonly success: boolean;
  readonly data?: MarketingCatalogCard;
};

export async function fetchCatalogTour(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly tourId: string;
}): Promise<MarketingCatalogCard | null> {
  const path = resolveCatalogTourApiPath(input.pluginId, input.tourId);
  const res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
    method: "GET",
    headers: { "x-tenant-id": input.tenantId },
    cache: resolveCatalogFetchCache(),
    next: resolveCatalogFetchNext(input.tenantId),
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`MARKETING_CATALOG_DETAIL_FAILED:${res.status}`);
  }
  const body = (await res.json()) as MarketingCatalogDetailResponse;
  return body.data ?? null;
}
