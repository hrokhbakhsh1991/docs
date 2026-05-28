import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { DENALI_FIELD_DEFINITIONS } from "./registry/denaliFieldRegistryData";

/**
 * Canonical model section roots — valid for spread reads/writes (`{ ...transport, mode }`).
 * Registry leaves live under these prefixes (e.g. `transport.mode`, `program.themeIds`).
 */
export const DENALI_CANONICAL_SECTION_ROOTS = [
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
  "overview",
  "metrics",
] as const;

/** Registry `tripDetails.*` paths map to top-level canonical slices. */
const REGISTRY_CANONICAL_ALIASES: Record<string, string> = {
  "tripDetails.overview.peakHeight": "overview.peakHeight",
  "tripDetails.overview.nonAttendanceDetails": "overview.nonAttendanceDetails",
  "tripDetails.overview.customServiceLabels": "customServiceLabels",
  "tripDetails.metrics.elevationGain": "metrics.elevationGain",
  "basicInfo.tourType": "category",
  "basicInfo.title": "title",
  "basicInfo.destinationId": "destinationId",
  "basicInfo.startDateTime": "startDateTime",
  "basicInfo.endDateTime": "endDateTime",
  "basicInfo.capacityMin": "capacityMin",
  "basicInfo.capacityMax": "capacityMax",
  "basicInfo.approximateReturnTime": "approximateReturnTime",
  "basicInfo.leaderUserIds": "leaderUserIds",
  "basicInfo.requiresLocalGuide": "requiresLocalGuide",
  "basicInfo.localGuideName": "localGuideName",
  "basicInfo.requiresManualAdminApproval": "requiresManualAdminApproval",
  "basicInfo.socialMediaLink": "socialMediaLink",
  "pricingPayment.requiresPayment": "pricing.requiresPayment",
  "pricingPayment.basePricePerPerson": "pricing.basePricePerPerson",
  "pricingPayment.paymentMode": "pricing.paymentMode",
  "pricingPayment.includesTourInsurance": "pricing.includesTourInsurance",
  "transport.transportMode": "transport.mode",
  "transport.transportCost": "transport.transportCost",
  "transport.allowPersonalCar": "transport.allowPersonalCar",
  "transport.dongAmount": "transport.dongAmount",
  "transport.transportNotes": "transport.transportNotes",
  "transport.adminCapacityApproval": "transport.adminCapacityApproval",
  "participantRequirements.minimumAge": "participants.minimumAge",
  "participantRequirements.maximumAge": "participants.maximumAge",
  "participantRequirements.fitnessLevel": "participants.fitnessLevel",
  "participantRequirements.nationalIdRequired": "participants.nationalIdRequired",
  "participantRequirements.sportsInsuranceRequired": "participants.sportsInsuranceRequired",
  "participantRequirements.minRequiredPeaks": "participants.minRequiredPeaks",
  "participantRequirements.fitnessPrerequisiteText": "participants.fitnessPrerequisiteText",
  "participantRequirements.gearItems": "participants.gearItems",
  "policies.policiesText": "policies.policiesText",
  "policies.cancellationDeadlineHours": "policies.cancellationDeadlineHours",
  "policies.cancellationPenaltyPercentage": "policies.cancellationPenaltyPercentage",
  "programNature.themeIds": "program.themeIds",
  "programNature.shortDescription": "program.shortDescription",
  "programNature.longDescription": "program.longDescription",
  "programNature.difficultyLevel": "program.difficultyLevel",
  "programNature.hikingHoursApprox": "program.hikingHoursApprox",
  "programNature.hikingGoHours": "program.hikingGoHours",
  "programNature.hikingReturnHours": "program.hikingReturnHours",
  "programNature.itinerary": "program.itinerary",
  "photosData.photos": "photos",
  "tripDetails.logistics.gatheringPoints": "gatheringPoints",
};

export function resolveDenaliRegistryCanonicalPath(canonicalPath: string): string {
  return REGISTRY_CANONICAL_ALIASES[canonicalPath] ?? canonicalPath;
}

export type DenaliCanonicalSectionRoot = (typeof DENALI_CANONICAL_SECTION_ROOTS)[number];

function isDenaliCanonicalSectionPath(canonicalPath: string): boolean {
  for (const root of DENALI_CANONICAL_SECTION_ROOTS) {
    if (canonicalPath === root || canonicalPath.startsWith(`${root}.`)) {
      return true;
    }
  }
  return false;
}

/** Registry leaf, section root, path under a section root, or parent of registered leaves. */
export function isKnownDenaliCanonicalPath(canonicalPath: string): boolean {
  if (isDenaliCanonicalSectionPath(canonicalPath)) {
    return true;
  }
  if (DENALI_FIELD_DEFINITIONS.some((def) => def.canonicalPath === canonicalPath)) {
    return true;
  }
  const childPrefix = `${canonicalPath}.`;
  return DENALI_FIELD_DEFINITIONS.some((def) => def.canonicalPath.startsWith(childPrefix));
}

/**
 * Reads a registry `canonicalPath` on the Denali canonical tour model
 * (e.g. `transport.transportCost`, `program.themeIds`, or section `program`).
 */
export function getDenaliCanonicalPathValue(
  model: DenaliCanonicalTourModel,
  canonicalPath: string,
): unknown {
  if (process.env.NODE_ENV === "development" && !isKnownDenaliCanonicalPath(canonicalPath)) {
  }

  const segments = resolveDenaliRegistryCanonicalPath(canonicalPath)
    .split(".")
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = model;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
