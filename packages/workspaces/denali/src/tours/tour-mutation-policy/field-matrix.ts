import type { DenaliTourMutationFieldClass } from "./types";

export type DenaliTourMutationFieldBinding = {
  readonly canonicalPath: string;
  readonly dataPaths: readonly string[];
  readonly mutationClass: DenaliTourMutationFieldClass;
};

/**
 * DEN-PROD-10 approved matrix — logical canonical paths with Denali data roots.
 * @see docs/workspaces/denali/tour-mutation-safety.mdoc
 */
export const DENALI_TOUR_MUTATION_FIELD_BINDINGS: readonly DenaliTourMutationFieldBinding[] =
  Object.freeze([
    {
      canonicalPath: "title",
      dataPaths: ["title", "basicInfo.title"],
      mutationClass: "SAFE_MUTABLE",
    },
    {
      canonicalPath: "program.shortDescription",
      dataPaths: ["programNature.shortDescription"],
      mutationClass: "SAFE_MUTABLE",
    },
    {
      canonicalPath: "photos",
      dataPaths: ["photosData.photos"],
      mutationClass: "SAFE_MUTABLE",
    },
    {
      canonicalPath: "program.itinerary",
      dataPaths: ["programNature.itinerary"],
      mutationClass: "SAFE_MUTABLE",
    },
    {
      canonicalPath: "participants.gearItems",
      dataPaths: ["participantRequirements.gearItems"],
      mutationClass: "SAFE_MUTABLE",
    },
    {
      canonicalPath: "destinationId",
      dataPaths: ["basicInfo.destinationId"],
      mutationClass: "FROZEN_AFTER_REGISTRATION",
    },
    {
      canonicalPath: "category",
      dataPaths: ["basicInfo.tourType", "category"],
      mutationClass: "FROZEN_AFTER_REGISTRATION",
    },
    {
      canonicalPath: "eventVariant",
      dataPaths: ["basicInfo.tourType", "eventVariant"],
      mutationClass: "FROZEN_AFTER_REGISTRATION",
    },
    {
      canonicalPath: "duration",
      dataPaths: ["basicInfo.tourType", "duration"],
      mutationClass: "FROZEN_AFTER_REGISTRATION",
    },
    {
      canonicalPath: "pricing.basePricePerPerson",
      dataPaths: ["pricingPayment.basePricePerPerson"],
      mutationClass: "MUTABLE_WITH_REPRICING",
    },
    {
      canonicalPath: "pricing.prepaymentPercent",
      dataPaths: ["pricingPayment.prepaymentPercent"],
      mutationClass: "MUTABLE_WITH_REPRICING",
    },
    {
      canonicalPath: "pricing.paymentMode",
      dataPaths: ["pricingPayment.paymentMode"],
      mutationClass: "FROZEN_AFTER_APPROVAL",
    },
    {
      canonicalPath: "pricing.requiresPayment",
      dataPaths: ["pricingPayment.requiresPayment"],
      mutationClass: "FROZEN_AFTER_APPROVAL",
    },
    {
      canonicalPath: "startDateTime",
      dataPaths: ["basicInfo.startDateTime", "startDateTime"],
      mutationClass: "MUTABLE_WITH_NOTIFICATION",
    },
    {
      canonicalPath: "endDateTime",
      dataPaths: ["basicInfo.endDateTime", "endDateTime"],
      mutationClass: "MUTABLE_WITH_NOTIFICATION",
    },
    {
      canonicalPath: "tripDetails.logistics.gatheringPoints",
      dataPaths: ["tripDetails.logistics.gatheringPoints"],
      mutationClass: "MUTABLE_WITH_NOTIFICATION",
    },
    {
      canonicalPath: "capacityMax",
      dataPaths: ["basicInfo.capacityMax", "capacityMax"],
      mutationClass: "REQUIRES_OPERATOR_OVERRIDE",
    },
    {
      canonicalPath: "transport.transportMode",
      dataPaths: ["transport.transportMode"],
      mutationClass: "REQUIRES_OPERATOR_OVERRIDE",
    },
    {
      canonicalPath: "transport.dongAmount",
      dataPaths: ["transport.dongAmount"],
      mutationClass: "REQUIRES_OPERATOR_OVERRIDE",
    },
    {
      canonicalPath: "transport.allowPersonalCar",
      dataPaths: ["transport.allowPersonalCar"],
      mutationClass: "REQUIRES_OPERATOR_OVERRIDE",
    },
  ]);
