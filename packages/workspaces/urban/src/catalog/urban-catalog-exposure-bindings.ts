import type { UrbanPublicCatalogEgress } from "./urban-public-catalog-surface";
import {
  applyWorkspaceCatalogCardFieldBindings,
  clearWorkspaceCatalogCardStringField,
  omitWorkspaceCatalogCardKey,
} from "@app-tour/workspace-sdk";
import { refreshUrbanCatalogStructuredData } from "./build-urban-event-jsonld";

export type UrbanCatalogCardExposureBinding = {
  readonly fieldId: string;
  readonly applyHidden: (card: UrbanPublicCatalogEgress) => UrbanPublicCatalogEgress;
};

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

/** Maps urban registry field ids to public catalog card redaction steps. */
export const URBAN_CATALOG_CARD_EXPOSURE_BINDINGS: readonly UrbanCatalogCardExposureBinding[] =
  Object.freeze([
    {
      fieldId: "tour.city",
      applyHidden: (card) =>
        clearWorkspaceCatalogCardStringField(
          clearWorkspaceCatalogCardStringField(card, "city"),
          "category",
        ),
    },
    {
      fieldId: "tour.venueName",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "venueName"),
    },
    {
      fieldId: "tour.startDate",
      applyHidden: (card) =>
        clearWorkspaceCatalogCardStringField(
          clearWorkspaceCatalogCardStringField(card, "startDate"),
          "departureAt",
        ),
    },
    {
      fieldId: "tour.endDate",
      applyHidden: (card) =>
        clearWorkspaceCatalogCardStringField(
          clearWorkspaceCatalogCardStringField(card, "endDate"),
          "endAt",
        ),
    },
    {
      fieldId: "tour.catalogSummary",
      applyHidden: (card) =>
        clearWorkspaceCatalogCardStringField(
          clearWorkspaceCatalogCardStringField(
            clearWorkspaceCatalogCardStringField(card, "catalogSummary"),
            "listDescription",
          ),
          "shortDescription",
        ),
    },
    {
      fieldId: "tour.coverImageUrl",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "coverImageUrl"),
    },
    {
      fieldId: "tour.description",
      applyHidden: (card) => card,
    },
    {
      fieldId: "tour.capacity",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "totalCapacity"),
    },
  ]);

export function applyUrbanCatalogCardExposure(
  card: UrbanPublicCatalogEgress,
  visibleFieldIds: ReadonlySet<string>,
): UrbanPublicCatalogEgress {
  let next = applyWorkspaceCatalogCardFieldBindings(
    card,
    visibleFieldIds,
    URBAN_CATALOG_CARD_EXPOSURE_BINDINGS,
  );
  if (!visibleFieldIds.has("tour.title")) {
    next = Object.freeze({ ...next, title: "Untitled tour" });
    next = omitWorkspaceCatalogCardKey(next, "structuredData");
  } else if ("structuredData" in next) {
    next = refreshUrbanCatalogStructuredData(next);
  }
  return recomputeDerivedPresentation(next);
}
