import type { PublicCatalogCard } from "@app-tour/workspace-sdk";
import {
  applyWorkspaceCatalogCardFieldBindings,
  clearWorkspaceCatalogCardStringField,
  omitWorkspaceCatalogCardKey,
} from "@app-tour/workspace-sdk";

import { refreshDenaliCatalogStructuredData } from "./denali-catalog-card";

export type DenaliCatalogCardExposureBinding = {
  readonly fieldId: string;
  readonly applyHidden: (card: PublicCatalogCard) => PublicCatalogCard;
};

function clearGatheringFields(card: PublicCatalogCard): PublicCatalogCard {
  const next = { ...card, gatheringPoint: null, meetingPointText: null };
  return Object.freeze(next);
}

function clearPhotos(card: PublicCatalogCard): PublicCatalogCard {
  const next = { ...clearWorkspaceCatalogCardStringField(card, "coverImageUrl") };
  return omitWorkspaceCatalogCardKey(next, "photoUrls");
}

/** Maps registry field ids to catalog card redaction steps. */
export const DENALI_CATALOG_CARD_EXPOSURE_BINDINGS: readonly DenaliCatalogCardExposureBinding[] =
  Object.freeze([
    { fieldId: "title", applyHidden: (card) => Object.freeze({ ...card, title: "Untitled tour" }) },
    {
      fieldId: "denali.destination",
      applyHidden: (card) =>
        Object.freeze({
          ...clearWorkspaceCatalogCardStringField(card, "category"),
          destinationLabel: null,
        }),
    },
    {
      fieldId: "denali.datetime",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "departureAt"),
    },
    {
      fieldId: "denali.datetime-end",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "endAt"),
    },
    {
      fieldId: "denali.pricing-participants",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "priceAmount"),
    },
    {
      fieldId: "denali.pricing-payment",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "paymentMode"),
    },
    {
      fieldId: "denali.photos",
      applyHidden: (card) => clearPhotos(card),
    },
    {
      fieldId: "capacityMax",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "totalCapacity"),
    },
    {
      fieldId: "meetingPoint",
      applyHidden: (card) => clearGatheringFields(card),
    },
    {
      fieldId: "startPointLocationText",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "meetingPointText"),
    },
  ]);

export function applyDenaliCatalogCardExposure(
  card: PublicCatalogCard,
  visibleFieldIds: ReadonlySet<string>
): PublicCatalogCard {
  let next = applyWorkspaceCatalogCardFieldBindings(
    card,
    visibleFieldIds,
    DENALI_CATALOG_CARD_EXPOSURE_BINDINGS
  );
  // Approximate return time is a surface-level PDP field, not an integration
  // delivery binding. Keep its catalog redaction explicit at this boundary.
  if (!visibleFieldIds.has("denali.approximate-return-time")) {
    next = clearWorkspaceCatalogCardStringField(next, "approximateReturnTime");
  }
  if (!visibleFieldIds.has("title")) {
    next = omitWorkspaceCatalogCardKey(next, "structuredData");
  } else if ("structuredData" in next) {
    next = refreshDenaliCatalogStructuredData(next);
  }
  return next;
}
