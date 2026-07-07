import type { UrbanPublicCatalogEgress } from "./urban-public-catalog-surface";
import { refreshUrbanCatalogStructuredData } from "./build-urban-event-jsonld";

export type UrbanCatalogCardExposureBinding = {
  readonly fieldId: string;
  readonly applyHidden: (card: UrbanPublicCatalogEgress) => UrbanPublicCatalogEgress;
};

function clearStringField(
  card: UrbanPublicCatalogEgress,
  key: keyof UrbanPublicCatalogEgress,
): UrbanPublicCatalogEgress {
  return Object.freeze({ ...card, [key]: null });
}

function joinListSubtitle(city: string | null | undefined, venueName: string | null | undefined): string | null {
  const parts = [city, venueName].filter((part): part is string => part != null && part.length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function recomputeDerivedPresentation(card: UrbanPublicCatalogEgress): UrbanPublicCatalogEgress {
  const city = card.city ?? null;
  const venueName = card.venueName ?? null;
  const listSubtitle = joinListSubtitle(city, venueName);
  return Object.freeze({
    ...card,
    category: city,
    listSubtitle,
  });
}

function clearStructuredData(card: UrbanPublicCatalogEgress): UrbanPublicCatalogEgress {
  const next = { ...card };
  delete (next as { structuredData?: unknown }).structuredData;
  return Object.freeze(next);
}

/** Maps urban registry field ids to public catalog card redaction steps. */
export const URBAN_CATALOG_CARD_EXPOSURE_BINDINGS: readonly UrbanCatalogCardExposureBinding[] =
  Object.freeze([
    {
      fieldId: "tour.city",
      applyHidden: (card) => clearStringField(clearStringField(card, "city"), "category"),
    },
    {
      fieldId: "tour.venueName",
      applyHidden: (card) => clearStringField(card, "venueName"),
    },
    {
      fieldId: "tour.startDate",
      applyHidden: (card) => clearStringField(clearStringField(card, "startDate"), "departureAt"),
    },
    {
      fieldId: "tour.endDate",
      applyHidden: (card) => clearStringField(clearStringField(card, "endDate"), "endAt"),
    },
    {
      fieldId: "tour.catalogSummary",
      applyHidden: (card) =>
        clearStringField(
          clearStringField(clearStringField(card, "catalogSummary"), "listDescription"),
          "shortDescription",
        ),
    },
    {
      fieldId: "tour.coverImageUrl",
      applyHidden: (card) => clearStringField(card, "coverImageUrl"),
    },
    {
      fieldId: "tour.description",
      applyHidden: (card) => card,
    },
    {
      fieldId: "tour.capacity",
      applyHidden: (card) => clearStringField(card, "totalCapacity"),
    },
  ]);

export function applyUrbanCatalogCardExposure(
  card: UrbanPublicCatalogEgress,
  visibleFieldIds: ReadonlySet<string>,
): UrbanPublicCatalogEgress {
  let next = card;
  for (const binding of URBAN_CATALOG_CARD_EXPOSURE_BINDINGS) {
    if (!visibleFieldIds.has(binding.fieldId)) {
      next = binding.applyHidden(next);
    }
  }
  if (!visibleFieldIds.has("tour.title")) {
    next = Object.freeze({ ...next, title: "Untitled tour" });
    next = clearStructuredData(next);
  } else if ("structuredData" in next) {
    next = refreshUrbanCatalogStructuredData(next);
  }
  return recomputeDerivedPresentation(next);
}
