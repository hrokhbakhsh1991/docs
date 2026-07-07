import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

type TouristTripOffer = {
  readonly "@type": "Offer";
  readonly price: number;
  readonly priceCurrency: string;
  readonly availability?: string;
};

type TouristTripJsonLd = {
  readonly "@context": "https://schema.org";
  readonly "@type": "TouristTrip";
  readonly name: string;
  readonly description?: string;
  readonly touristType?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly image?: string;
  readonly dateModified?: string;
  readonly offers?: TouristTripOffer;
  readonly itinerary?: {
    readonly "@type": "ItemList";
    readonly itemListElement: readonly {
      readonly "@type": "ListItem";
      readonly position: number;
      readonly item: {
        readonly "@type": "TouristTrip";
        readonly name: string;
        readonly description?: string;
      };
    }[];
  };
};

function buildOffer(card: PublicCatalogCard): TouristTripOffer | undefined {
  if (card.priceAmount === null || card.priceAmount === undefined) {
    return undefined;
  }
  const offer: TouristTripOffer = {
    "@type": "Offer",
    price: card.priceAmount,
    priceCurrency: card.priceCurrency,
  };
  if (card.spotsRemaining === 0) {
    return { ...offer, availability: "https://schema.org/SoldOut" };
  }
  if (card.spotsRemaining != null) {
    return { ...offer, availability: "https://schema.org/InStock" };
  }
  return offer;
}

function buildDayDescription(
  day: NonNullable<PublicCatalogCard["itineraryDays"]>[number]
): string | undefined {
  const parts: string[] = [];
  if (day.summary?.trim()) {
    parts.push(day.summary.trim());
  }
  for (const segment of day.segments) {
    const segmentParts = [segment.title.trim()];
    if (segment.startTime?.trim()) {
      segmentParts.unshift(segment.startTime.trim());
    }
    if (segment.locationLabel?.trim()) {
      segmentParts.push(`@ ${segment.locationLabel.trim()}`);
    }
    parts.push(segmentParts.join(" — "));
  }
  return parts.length > 0 ? parts.join("\n") : undefined;
}

/** Build Schema.org `TouristTrip` JSON-LD from an egress-safe catalog card. */
export function buildDenaliTouristTripJsonLd(card: PublicCatalogCard): TouristTripJsonLd {
  const itineraryDays = card.itineraryDays;
  const cover = card.coverImageUrl?.trim();
  const updatedAt = card.catalogUpdatedAt?.trim();
  const offer = buildOffer(card);

  const payload: TouristTripJsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: card.title,
    ...(card.shortDescription?.trim() ? { description: card.shortDescription.trim() } : {}),
    ...(card.category?.trim() ? { touristType: card.category.trim() } : {}),
    ...(card.departureAt?.trim() ? { startDate: card.departureAt.trim() } : {}),
    ...(card.endAt?.trim() ? { endDate: card.endAt.trim() } : {}),
    ...(cover !== undefined && cover.length > 0 ? { image: cover } : {}),
    ...(updatedAt !== undefined && updatedAt.length > 0 ? { dateModified: updatedAt } : {}),
    ...(offer !== undefined ? { offers: offer } : {}),
  };

  if (itineraryDays == null || itineraryDays.length === 0) {
    return Object.freeze(payload);
  }

  return Object.freeze({
    ...payload,
    itinerary: Object.freeze({
      "@type": "ItemList",
      itemListElement: Object.freeze(
        itineraryDays.map((day, index) =>
          Object.freeze({
            "@type": "ListItem",
            position: index + 1,
            item: Object.freeze({
              "@type": "TouristTrip",
              name: day.title,
              ...(buildDayDescription(day) != null ? { description: buildDayDescription(day) } : {}),
            }),
          })
        )
      ),
    }),
  });
}
