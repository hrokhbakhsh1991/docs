import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

export type DenaliCatalogCardExposureBinding = {
  readonly fieldId: string;
  readonly applyHidden: (card: PublicCatalogCard) => PublicCatalogCard;
};

function clearStringField(
  card: PublicCatalogCard,
  key: keyof PublicCatalogCard,
): PublicCatalogCard {
  return Object.freeze({ ...card, [key]: null });
}

function clearItinerary(card: PublicCatalogCard): PublicCatalogCard {
  const next = { ...card };
  delete (next as { itineraryDays?: unknown }).itineraryDays;
  return Object.freeze(next);
}

function clearStructuredData(card: PublicCatalogCard): PublicCatalogCard {
  const next = { ...card };
  delete (next as { structuredData?: unknown }).structuredData;
  return Object.freeze(next);
}

/** Maps registry field ids to catalog card redaction steps. */
export const DENALI_CATALOG_CARD_EXPOSURE_BINDINGS: readonly DenaliCatalogCardExposureBinding[] =
  Object.freeze([
    { fieldId: "title", applyHidden: (card) => Object.freeze({ ...card, title: "Untitled tour" }) },
    {
      fieldId: "denali.destination",
      applyHidden: (card) => clearStringField(card, "category"),
    },
    {
      fieldId: "denali.datetime",
      applyHidden: (card) => clearStringField(card, "departureAt"),
    },
    {
      fieldId: "denali.datetime-end",
      applyHidden: (card) => clearStringField(card, "endAt"),
    },
    {
      fieldId: "denali.pricing-participants",
      applyHidden: (card) => clearStringField(card, "priceAmount"),
    },
    {
      fieldId: "denali.photos",
      applyHidden: (card) => clearStringField(card, "coverImageUrl"),
    },
    {
      fieldId: "capacityMax",
      applyHidden: (card) => clearStringField(card, "totalCapacity"),
    },
    {
      fieldId: "meetingPoint",
      applyHidden: (card) => clearItinerary(card),
    },
    {
      fieldId: "startPointLocationText",
      applyHidden: (card) => clearItinerary(card),
    },
  ]);

export function applyDenaliCatalogCardExposure(
  card: PublicCatalogCard,
  visibleFieldIds: ReadonlySet<string>,
): PublicCatalogCard {
  let next = card;
  for (const binding of DENALI_CATALOG_CARD_EXPOSURE_BINDINGS) {
    if (!visibleFieldIds.has(binding.fieldId)) {
      next = binding.applyHidden(next);
    }
  }
  if (!visibleFieldIds.has("title")) {
    next = clearStructuredData(next);
  }
  return next;
}
