import type { CatalogListFilters } from "./catalog-list-query";
import type { MarketingCatalogCard } from "./catalog-types";
import { filterMarketingCatalogItems } from "./filter-marketing-catalog-items";
import { sortMarketingCatalogItems } from "./sort-marketing-catalog-items";

export type MarketingCatalogListPipelineResult = {
  readonly items: readonly MarketingCatalogCard[];
  readonly matchedCount: number;
  readonly fetchedCount: number;
};

/** Apply filter + sort on the fetched batch (always — idempotent with server egress). */
export async function applyMarketingCatalogListPipeline(
  fetchedItems: readonly MarketingCatalogCard[],
  filters: CatalogListFilters,
  serverListFilters: readonly string[] = [],
  pluginId?: string
): Promise<MarketingCatalogListPipelineResult> {
  void serverListFilters;
  const filteredItems = await filterMarketingCatalogItems(
    fetchedItems,
    {
      q: filters.q,
      category: filters.category,
      difficulty: filters.difficulty,
      fitness: filters.fitness,
      availability: filters.availability,
    },
    pluginId
  );
  const items = sortMarketingCatalogItems(filteredItems, filters.sort);
  return {
    items,
    matchedCount: items.length,
    fetchedCount: fetchedItems.length,
  };
}
