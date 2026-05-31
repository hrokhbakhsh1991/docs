import {
  getTourFormProfileDescriptor,
  MOUNTAIN_TRANSPORT_ECONOMICS_LOGISTICS_KEYS,
  type TourFormProfile,
} from "@repo/types";

/**
 * Silently evicts mountain/outdoor dong logistics keys when the profile does not
 * require transport economics (Wave 3 / Task 3.5 hardened ingress trimmer).
 */
export function evictNonMountainTransportEconomicsLogistics(
  profile: TourFormProfile,
  tripDetails: Record<string, unknown>,
): void {
  const { invariants } = getTourFormProfileDescriptor(profile);
  if (invariants.requiresMountainTransportEconomics) {
    return;
  }
  const logistics = tripDetails.logistics;
  if (logistics == null || typeof logistics !== "object" || Array.isArray(logistics)) {
    return;
  }
  const log = logistics as Record<string, unknown>;
  for (const key of MOUNTAIN_TRANSPORT_ECONOMICS_LOGISTICS_KEYS) {
    delete log[key];
  }
  if (Object.keys(log).length === 0) {
    delete tripDetails.logistics;
  }
}

/**
 * Canonical profile strip for `tripDetails` JSONB (create/update wire).
 * Rules are sourced from {@link getTourFormProfileDescriptor} in `@repo/types`.
 */
export function stripTripDetailsForFormProfile(
  profile: TourFormProfile,
  tripDetails: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (tripDetails == null || typeof tripDetails !== "object" || Array.isArray(tripDetails)) {
    return tripDetails ?? undefined;
  }

  const { strip, invariants } = getTourFormProfileDescriptor(profile);

  const logisticsRecord =
    tripDetails.logistics != null && typeof tripDetails.logistics === "object" && !Array.isArray(tripDetails.logistics)
      ? (tripDetails.logistics as Record<string, unknown>)
      : null;
  const hasStaleMountainEconomicsKeys =
    !invariants.requiresMountainTransportEconomics &&
    logisticsRecord != null &&
    MOUNTAIN_TRANSPORT_ECONOMICS_LOGISTICS_KEYS.some((key) => logisticsRecord[key] !== undefined);

  const needsDescriptorStrip =
    strip.clearsTripDetailsRoots.length > 0 ||
    strip.itineraryKeysToDelete.length > 0 ||
    strip.logisticsWhitelist != null ||
    (strip.logisticsKeysToDelete != null && strip.logisticsKeysToDelete.length > 0);

  if (!needsDescriptorStrip && !hasStaleMountainEconomicsKeys) {
    return tripDetails;
  }

  const root = needsDescriptorStrip
    ? (JSON.parse(JSON.stringify(tripDetails)) as Record<string, unknown>)
    : ({
        ...tripDetails,
        logistics:
          logisticsRecord != null ? { ...logisticsRecord } : tripDetails.logistics,
      } as Record<string, unknown>);

  for (const key of strip.clearsTripDetailsRoots) {
    delete root[key];
  }

  if (
    strip.itineraryKeysToDelete.length > 0 &&
    root.itinerary != null &&
    typeof root.itinerary === "object"
  ) {
    const it = { ...(root.itinerary as Record<string, unknown>) };
    for (const k of strip.itineraryKeysToDelete) {
      delete it[k];
    }
    if (Object.keys(it).length === 0) {
      delete root.itinerary;
    } else {
      root.itinerary = it;
    }
  }

  if (strip.logisticsWhitelist != null && root.logistics != null && typeof root.logistics === "object") {
    const log = root.logistics as Record<string, unknown>;
    const slim: Record<string, unknown> = {};
    for (const key of strip.logisticsWhitelist) {
      if (log[key] !== undefined) {
        slim[key] = log[key];
      }
    }
    root.logistics = slim;
  }

  if (
    strip.logisticsKeysToDelete != null &&
    strip.logisticsKeysToDelete.length > 0 &&
    root.logistics != null &&
    typeof root.logistics === "object"
  ) {
    const log = root.logistics as Record<string, unknown>;
    for (const key of strip.logisticsKeysToDelete) {
      delete log[key];
    }
    if (Object.keys(log).length === 0) {
      delete root.logistics;
    }
  }

  evictNonMountainTransportEconomicsLogistics(profile, root);

  return root;
}

export type CreateTourDtoWireLike = Record<string, unknown> & {
  tripDetails?: Record<string, unknown> | null;
  transportModes?: unknown;
};

/**
 * Profile strip for create-tour wire payloads. Clears inactive tripDetails branches and
 * root `transportModes` when the profile contract requires it.
 */
export function stripCreateTourDtoForFormProfile<T extends CreateTourDtoWireLike>(
  profile: TourFormProfile,
  dto: T,
): T {
  const { strip, invariants } = getTourFormProfileDescriptor(profile);
  const tripDetails = dto.tripDetails;
  const logisticsRecord =
    tripDetails != null &&
    typeof tripDetails === "object" &&
    !Array.isArray(tripDetails) &&
    tripDetails.logistics != null &&
    typeof tripDetails.logistics === "object" &&
    !Array.isArray(tripDetails.logistics)
      ? (tripDetails.logistics as Record<string, unknown>)
      : null;
  const hasStaleMountainEconomicsKeys =
    !invariants.requiresMountainTransportEconomics &&
    logisticsRecord != null &&
    MOUNTAIN_TRANSPORT_ECONOMICS_LOGISTICS_KEYS.some((key) => logisticsRecord[key] !== undefined);

  const needsTripDetailsStrip =
    strip.clearsTripDetailsRoots.length > 0 ||
    strip.itineraryKeysToDelete.length > 0 ||
    strip.logisticsWhitelist != null ||
    (strip.logisticsKeysToDelete != null && strip.logisticsKeysToDelete.length > 0) ||
    hasStaleMountainEconomicsKeys;

  if (
    !needsTripDetailsStrip &&
    !strip.clearsRootTransportModes
  ) {
    return dto;
  }

  const next = { ...dto };
  if (next.tripDetails != null && needsTripDetailsStrip) {
    next.tripDetails = stripTripDetailsForFormProfile(profile, next.tripDetails);
  }
  if (strip.clearsRootTransportModes) {
    delete next.transportModes;
  }
  return next;
}
