import type { PublicCatalogCard, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { isUrbanTourPublished, toUrbanCatalogCard } from "../http/publish-status";

export { isUrbanTourPublished };

export function toUrbanPublicCatalogCard(tour: PublicCatalogTourInput): PublicCatalogCard {
  const card = toUrbanCatalogCard({
    id: tour.id,
    createdAt: "",
    canonical: tour.canonical,
  });
  return {
    id: card.id,
    title: card.title ?? "",
    shortDescription: card.catalogSummary,
    category: card.city,
    departureAt: card.startDate,
    endAt: card.endDate,
    priceAmount: null,
    priceCurrency: "",
    coverImageUrl: card.coverImageUrl,
    totalCapacity: null,
  };
}
