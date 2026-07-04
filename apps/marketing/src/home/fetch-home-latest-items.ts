import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard, MarketingCatalogListResult } from "@/catalog/catalog-types";

import { fetchHomeCatalogItems } from "./fetch-home-catalog-items";

export type FetchCatalogListFn = (input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly limit?: number;
}) => Promise<MarketingCatalogListResult>;

/** @deprecated Use fetchHomeCatalogItems — kept for backwards-compatible imports. */
export async function fetchHomeLatestItems(input: {
  readonly landing: GuestLandingFeatures;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly fetchCatalogList: FetchCatalogListFn;
}): Promise<readonly MarketingCatalogCard[]> {
  const items = await fetchHomeCatalogItems(input);
  if (!input.landing.sections.latestTours || input.landing.sections.latestToursLimit <= 0) {
    return [];
  }
  return items.slice(0, input.landing.sections.latestToursLimit);
}
