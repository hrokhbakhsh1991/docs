import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

import { buildGuestClubEventJsonLd } from "./build-guest-club-event-jsonld";

/** Phase 9.9 smoke — published guest-club catalog tour (SMK-MKT-13). */
export const GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000420" as const;

export const GUEST_CLUB_SMOKE_PUBLISHED_TOUR_TITLE = "Club weekend getaway" as const;

const GUEST_CLUB_SMOKE_CATALOG_UPDATED_AT = "2026-07-01T08:00:00.000Z" as const;

export function buildGuestClubSmokeCatalogCard(): PublicCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID,
    title: GUEST_CLUB_SMOKE_PUBLISHED_TOUR_TITLE,
    shortDescription: "Guest-club smoke catalog event",
    category: "club_event",
    departureAt: "2026-08-15T10:00:00.000Z",
    endAt: "2026-08-17T18:00:00.000Z",
    priceAmount: 1_200_000,
    priceCurrency: "IRR",
    coverImageUrl: null,
    totalCapacity: 24,
    catalogUpdatedAt: GUEST_CLUB_SMOKE_CATALOG_UPDATED_AT,
  });

  return Object.freeze({
    ...card,
    structuredData: buildGuestClubEventJsonLd(card) as unknown as Readonly<Record<string, unknown>>,
  });
}
