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

function clearParticipantPricing(card: PublicCatalogCard): PublicCatalogCard {
  return Object.freeze({
    ...card,
    priceAmount: null,
    minimumAge: null,
    maximumAge: null,
    fitnessLevel: null,
    fitnessPrerequisiteText: null,
  });
}

function clearPaymentPolicy(card: PublicCatalogCard): PublicCatalogCard {
  let next = clearWorkspaceCatalogCardStringField(card, "paymentMode");
  for (const key of [
    "paymentPlan",
    "paymentCollection",
    "registrationApproval",
    "includesTourInsurance",
  ]) {
    next = omitWorkspaceCatalogCardKey(next, key);
  }
  return next;
}

function clearTransport(card: PublicCatalogCard): PublicCatalogCard {
  return omitWorkspaceCatalogCardKey(card, "transport");
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
      fieldId: "denali.approximate-return-time",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "approximateReturnTime"),
    },
    {
      fieldId: "denali.pricing-participants",
      applyHidden: clearParticipantPricing,
    },
    {
      fieldId: "denali.pricing-payment",
      applyHidden: clearPaymentPolicy,
    },
    {
      fieldId: "denali.transport-mode",
      applyHidden: clearTransport,
    },
    {
      fieldId: "denali.social-media-link",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "socialMediaLink"),
    },
    {
      fieldId: "denali.photos",
      applyHidden: (card) => clearPhotos(card),
    },
    {
      fieldId: "capacityMax",
      applyHidden: (card) =>
        Object.freeze({ ...card, totalCapacity: null, spotsRemaining: null }),
    },
    {
      fieldId: "meetingPoint",
      applyHidden: (card) => clearGatheringFields(card),
    },
    {
      fieldId: "startPointLocationText",
      applyHidden: (card) => clearWorkspaceCatalogCardStringField(card, "meetingPointText"),
    },
    {
      fieldId: "denali.location-zones",
      applyHidden: clearGatheringFields,
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
  if (!visibleFieldIds.has("title")) {
    next = omitWorkspaceCatalogCardKey(next, "structuredData");
  } else if ("structuredData" in next) {
    next = refreshDenaliCatalogStructuredData(next);
  }
  return next;
}
