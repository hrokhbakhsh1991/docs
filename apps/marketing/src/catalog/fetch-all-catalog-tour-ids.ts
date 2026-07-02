import { fetchCatalogList } from "./fetch-catalog-list";

const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_MAX_PAGES = 50;

export type MarketingCatalogSitemapTour = {
  readonly tourId: string;
  readonly catalogUpdatedAt: string | null;
  readonly coverImageUrl: string | null;
};

/** Paginate catalog list for sitemap generation (no query params). */
export async function fetchAllCatalogSitemapTours(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly pageLimit?: number;
  readonly maxPages?: number;
}): Promise<readonly MarketingCatalogSitemapTour[]> {
  const pageLimit = input.pageLimit ?? DEFAULT_PAGE_LIMIT;
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const tours: MarketingCatalogSitemapTour[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const { items, nextCursor } = await fetchCatalogList({
      tenantId: input.tenantId,
      pluginId: input.pluginId,
      cursor,
      limit: pageLimit,
    });

    for (const item of items) {
      const tourId = item.id?.trim();
      if (tourId === undefined || tourId.length === 0) {
        continue;
      }
      tours.push({
        tourId,
        catalogUpdatedAt: item.catalogUpdatedAt?.trim() ?? null,
        coverImageUrl: item.coverImageUrl?.trim() ?? null,
      });
    }

    if (nextCursor === null || nextCursor.trim().length === 0) {
      break;
    }
    cursor = nextCursor;
  }

  return tours;
}

/** @deprecated Use fetchAllCatalogSitemapTours — kept for callers needing ids only. */
export async function fetchAllCatalogTourIds(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly pageLimit?: number;
  readonly maxPages?: number;
}): Promise<readonly string[]> {
  const tours = await fetchAllCatalogSitemapTours(input);
  return tours.map((tour) => tour.tourId);
}
