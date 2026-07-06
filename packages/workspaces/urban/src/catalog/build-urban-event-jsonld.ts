import type { UrbanPublicCatalogEgress } from "./urban-public-catalog-egress.types";

type EventJsonLd = {
  readonly "@context": "https://schema.org";
  readonly "@type": "Event";
  readonly name: string;
  readonly description?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly eventStatus?: string;
  readonly eventAttendanceMode?: string;
  readonly image?: string;
  readonly dateModified?: string;
  readonly location?: {
    readonly "@type": "Place";
    readonly name: string;
  };
};

function readCityVenue(card: UrbanPublicCatalogEgress): { readonly city: string | null; readonly venue: string | null } {
  return {
    city: card.city?.trim() || null,
    venue: card.venueName?.trim() || null,
  };
}

/** Build Schema.org `Event` JSON-LD from an egress-safe Urban catalog card. */
export function buildUrbanEventJsonLd(card: UrbanPublicCatalogEgress): EventJsonLd {
  const { city, venue } = readCityVenue(card);
  const locationName = [venue, city].filter((part): part is string => part != null).join(", ");
  const cover = card.coverImageUrl?.trim();
  const updatedAt = card.catalogUpdatedAt?.trim() ?? card.publishedAt?.trim();

  return Object.freeze({
    "@context": "https://schema.org",
    "@type": "Event",
    name: card.title,
    ...(card.shortDescription?.trim() ? { description: card.shortDescription.trim() } : {}),
    ...(card.departureAt?.trim() ? { startDate: card.departureAt.trim() } : {}),
    ...(card.endAt?.trim() ? { endDate: card.endAt.trim() } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(cover !== undefined && cover.length > 0 ? { image: cover } : {}),
    ...(updatedAt !== undefined && updatedAt.length > 0 ? { dateModified: updatedAt } : {}),
    ...(locationName.length > 0
      ? {
          location: Object.freeze({
            "@type": "Place",
            name: locationName,
          }),
        }
      : {}),
  });
}

export function refreshUrbanCatalogStructuredData(
  card: UrbanPublicCatalogEgress
): UrbanPublicCatalogEgress {
  return Object.freeze({
    ...card,
    structuredData: buildUrbanEventJsonLd(card) as unknown as Readonly<Record<string, unknown>>,
  });
}