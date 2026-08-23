import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Opt-in guest smoke catalog card — enable with PROFILE_CERT_SMOKE_E2E_SEED=1. */
export const PROFILE_CERT_SMOKE_TOUR_ID = "a5ab35fd-1208-4605-a375-03a4a0846159" as const;
export const PROFILE_CERT_SMOKE_TOUR_TITLE = "ProfileCert smoke sail" as const;

export function buildProfileCertSmokeCatalogCard(): PublicCatalogCard {
  const card: PublicCatalogCard = Object.freeze({
    id: PROFILE_CERT_SMOKE_TOUR_ID,
    title: PROFILE_CERT_SMOKE_TOUR_TITLE,
    shortDescription: "profile-cert smoke catalog event",
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
