import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type MarketingCatalogListJsonLdItem = {
  readonly tourId: string;
  readonly title: string;
};

export function shouldEmitMarketingCatalogListJsonLd(input: {
  readonly cursor?: string | null;
}): boolean {
  const cursor = input.cursor?.trim();
  return cursor === undefined || cursor.length === 0;
}

/** ItemList JSON-LD for the marketing catalog list (first page only). */
export function buildMarketingCatalogListJsonLd(input: {
  readonly host: string;
  readonly listLabel: string;
  readonly items: readonly MarketingCatalogListJsonLdItem[];
}): Readonly<Record<string, unknown>> {
  const origin = resolveMarketingPublicOrigin(input.host);

  return Object.freeze({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: input.listLabel,
    itemListElement: Object.freeze(
      input.items.map((item, index) => {
        const path = `/tours/${encodeURIComponent(item.tourId.trim())}`;
        return Object.freeze({
          "@type": "ListItem",
          position: index + 1,
          name: item.title,
          url: `${origin}${path}`,
        });
      })
    ),
  });
}
