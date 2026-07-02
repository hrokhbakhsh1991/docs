import type { PublicCatalogCard, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { buildUrbanEventJsonLd } from "./build-urban-event-jsonld";
import { isUrbanTourPublished, toUrbanCatalogCard } from "../http/publish-status";

export { isUrbanTourPublished };

/** Urban HTTP egress — SDK card + M2b extension fields for marketing JSON. */
export type UrbanPublicCatalogEgress = PublicCatalogCard & {
  readonly city?: string | null;
  readonly venueName?: string | null;
  readonly catalogSummary?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly publishedAt?: string | null;
  readonly publishStatus?: string | null;
};

function joinListSubtitle(city: string | null, venueName: string | null): string | null {
  const parts = [city, venueName].filter((part): part is string => part != null && part.length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function toUrbanPublicCatalogCard(tour: PublicCatalogTourInput): UrbanPublicCatalogEgress {
  const card = toUrbanCatalogCard({
    id: tour.id,
    createdAt: "",
    canonical: tour.canonical,
  });
  const listSubtitle = joinListSubtitle(card.city, card.venueName);
  const catalogUpdatedAt =
    tour.catalogUpdatedAt?.trim() || card.publishedAt?.trim() || null;
  const egress: UrbanPublicCatalogEgress = {
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
    listSubtitle,
    listDescription: card.catalogSummary,
    showListPrice: false,
    ...(catalogUpdatedAt != null ? { catalogUpdatedAt } : {}),
    city: card.city,
    venueName: card.venueName,
    catalogSummary: card.catalogSummary,
    startDate: card.startDate,
    endDate: card.endDate,
    publishedAt: card.publishedAt,
    publishStatus: typeof card.publishStatus === "string" ? card.publishStatus : null,
  };
  return Object.freeze({
    ...egress,
    structuredData: buildUrbanEventJsonLd(egress) as unknown as Readonly<Record<string, unknown>>,
  });
}
