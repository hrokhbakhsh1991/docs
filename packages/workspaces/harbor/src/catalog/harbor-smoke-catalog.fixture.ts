import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

import { buildHarborEventJsonLd } from "./build-harbor-event-jsonld";

/** DG-4.1/4.2 smoke — published harbor catalog tour (city G1). */
export const HARBOR_SMOKE_PUBLISHED_TOUR_ID =
  "00000000-0000-4000-8000-000000000521" as const;

export const HARBOR_SMOKE_PUBLISHED_TOUR_TITLE = "Harbor evening sail" as const;

/** City key used by smoke `?city=` filter (DG-4.2). */
export const HARBOR_SMOKE_PUBLISHED_TOUR_CITY = "bandar" as const;

const HARBOR_SMOKE_CATALOG_UPDATED_AT = "2026-07-31T12:00:00.000Z" as const;

export type HarborSmokeCatalogCard = PublicCatalogCard & {
  readonly city: string;
};

export function buildHarborSmokeCatalogCard(): HarborSmokeCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
    title: HARBOR_SMOKE_PUBLISHED_TOUR_TITLE,
    shortDescription: "Harbor smoke catalog waterfront event",
    category: "city_sail",
    departureAt: "2026-09-12T17:00:00.000Z",
    endAt: "2026-09-12T21:00:00.000Z",
    priceAmount: 850_000,
    priceCurrency: "IRR",
    coverImageUrl: null,
    totalCapacity: 18,
    catalogUpdatedAt: HARBOR_SMOKE_CATALOG_UPDATED_AT,
    listSubtitle: HARBOR_SMOKE_PUBLISHED_TOUR_CITY,
    policiesText: "Harbor smoke cancellation: free until 24h before departure.",
    cancellationDeadlineHours: 24,
    cancellationPenaltyPercentage: 50,
  });

  return Object.freeze({
    ...card,
    city: HARBOR_SMOKE_PUBLISHED_TOUR_CITY,
    structuredData: buildHarborEventJsonLd(card) as unknown as Readonly<
      Record<string, unknown>
    >,
  });
}
