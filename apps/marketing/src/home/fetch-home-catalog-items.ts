import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard, MarketingCatalogListResult } from "@/catalog/catalog-types";

import {
  resolveHomeCatalogFetchLimit,
  shouldFetchHomeCatalog,
} from "./resolve-home-catalog-fetch-limit";

export type FetchCatalogListFn = (input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly limit?: number;
}) => Promise<MarketingCatalogListResult>;

/** Fail-soft unified catalog fetch for home latest / featured / categories (PR-7). */
export async function fetchHomeCatalogItems(input: {
  readonly landing: GuestLandingFeatures;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly fetchCatalogList: FetchCatalogListFn;
}): Promise<readonly MarketingCatalogCard[]> {
  if (!shouldFetchHomeCatalog(input.landing)) {
    return [];
  }

  const limit = resolveHomeCatalogFetchLimit(input.landing);

  try {
    const result = await input.fetchCatalogList({
      tenantId: input.tenantId,
      pluginId: input.pluginId,
      limit,
    });
    return result.items;
  } catch (err) {
    console.warn("marketing.home.catalog_fetch_failed", err);
    return [];
  }
}
