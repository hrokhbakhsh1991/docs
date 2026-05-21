/** Denali wizard location zone keys (Phase 7 — clone / server draft round-trip). */
export const DENALI_LOCATION_ZONE_KEYS = [
  "gatheringPoint",
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
] as const;

export type DenaliLocationZoneKey = (typeof DENALI_LOCATION_ZONE_KEYS)[number];

export const DENALI_ROOTS = [
  "basicInfo",
  "programNature",
  "transport",
  "pricingPayment",
  "participantRequirements",
  "policies",
  "photosData",
] as const;

export type DenaliRoot = typeof DENALI_ROOTS[number];
