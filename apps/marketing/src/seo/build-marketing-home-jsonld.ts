import { buildMarketingCatalogListJsonLd } from "./build-marketing-catalog-list-jsonld";

export type MarketingHomeJsonLdItem = {
  readonly tourId: string;
  readonly title: string;
};

/** ItemList JSON-LD for home `/` when catalog-backed blocks have items (PR-8 P14). */
export function buildMarketingHomeJsonLd(input: {
  readonly host: string;
  readonly listLabel: string;
  readonly items: readonly MarketingHomeJsonLdItem[];
}): Readonly<Record<string, unknown>> | null {
  if (input.items.length === 0) {
    return null;
  }
  return buildMarketingCatalogListJsonLd(input);
}

export function shouldEmitMarketingHomeJsonLd(catalogItemsCount: number): boolean {
  return catalogItemsCount > 0;
}
