/** Denali wizard location zone keys (clone / canonical round-trip). */
export const DENALI_LOCATION_ZONE_KEYS = [
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
  "tripDetails",
] as const;

export type DenaliRoot = typeof DENALI_ROOTS[number];
