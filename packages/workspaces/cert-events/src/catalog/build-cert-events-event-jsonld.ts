import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

type EventJsonLd = {
  readonly "@context": "https://schema.org";
  readonly "@type": "Event";
  readonly name: string;
  readonly description?: string;
  readonly eventStatus: string;
  readonly dateModified?: string;
};

/** Minimal Event JSON-LD for cert-events catalog card stubs (guestSeo.builderExport). */
export function buildCertEventsEventJsonLd(card: PublicCatalogCard): EventJsonLd {
  return Object.freeze({
    "@context": "https://schema.org",
    "@type": "Event",
    name: card.title,
    ...(card.shortDescription?.trim() ? { description: card.shortDescription.trim() } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    ...(card.catalogUpdatedAt?.trim() ? { dateModified: card.catalogUpdatedAt.trim() } : {}),
  });
}
