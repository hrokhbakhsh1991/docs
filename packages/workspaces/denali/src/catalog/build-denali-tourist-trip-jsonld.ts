import type { PublicCatalogCard, PublicCatalogItineraryDay } from "@app-tour/workspace-sdk";

type TouristTripJsonLd = {
  readonly "@context": "https://schema.org";
  readonly "@type": "TouristTrip";
  readonly name: string;
  readonly description?: string;
  readonly touristType?: string;
  readonly startDate?: string;
  readonly endDate?: string;
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

function buildDayDescription(day: PublicCatalogItineraryDay): string | undefined {
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
  const payload: TouristTripJsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: card.title,
    ...(card.shortDescription?.trim() ? { description: card.shortDescription.trim() } : {}),
    ...(card.category?.trim() ? { touristType: card.category.trim() } : {}),
    ...(card.departureAt?.trim() ? { startDate: card.departureAt.trim() } : {}),
    ...(card.endAt?.trim() ? { endDate: card.endAt.trim() } : {}),
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
