import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Opt-in guest smoke catalog card — enable with CERT_CLUB_SMOKE_E2E_SEED=1. */
export const CERT_CLUB_SMOKE_TOUR_ID = "602c63e6-3735-49a4-b7dc-0ce9ca55a3ca" as const;
export const CERT_CLUB_SMOKE_TOUR_TITLE = "CertClub smoke sail" as const;

export function buildCertClubSmokeCatalogCard(): PublicCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: CERT_CLUB_SMOKE_TOUR_ID,
    title: CERT_CLUB_SMOKE_TOUR_TITLE,
    shortDescription: "cert-club smoke catalog event",
    category: "guest_event",
    departureAt: "2026-10-01T10:00:00.000Z",
    endAt: "2026-10-01T18:00:00.000Z",
    priceAmount: 1_000_000,
    priceCurrency: "IRR",
    coverImageUrl: null,
    totalCapacity: 20,
    catalogUpdatedAt: "2026-07-31T12:00:00.000Z",
  });
  return Object.freeze({
    ...card,
    structuredData: Object.freeze({
      "@context": "https://schema.org",
      "@type": "Event",
      name: card.title,
      eventStatus: "https://schema.org/EventScheduled",
      dateModified: card.catalogUpdatedAt,
    }) as unknown as Readonly<Record<string, unknown>>,
  });
}
