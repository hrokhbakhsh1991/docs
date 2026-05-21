import type { TourFormProfile } from "@repo/types";
import {
  URBAN_LOGISTICS_WHITELIST_KEYS,
  getTourFormProfileDescriptor,
  isDenaliTourKind,
} from "@repo/types";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourTripDetails } from "../types/tour-trip-details.types";

/**
 * Logistics keys that remain when `urban_event` strips the logistics wizard group (dates / meet).
 *
 * Canonical single source: {@link URBAN_LOGISTICS_WHITELIST_KEYS} in `@repo/types`. This
 * `Set` wrapper exists only for the existing `.has(key)` call sites in `assert-create-tour-invariants.ts`
 * — those call sites can be migrated to the array form in Phase C without re-touching the constant.
 */
export const URBAN_LOGISTICS_WHITELIST: ReadonlySet<string> = new Set(URBAN_LOGISTICS_WHITELIST_KEYS);

/** Clears returnDate/Time for single-day Denali tours (ghost logistics). */
function stripDenaliSingleDayLogistics(td: TourTripDetails): void {
  const overview = td.overview as Record<string, unknown> | undefined;
  const kind = overview?.denaliTourKind;
  if (typeof kind === "string" && isDenaliTourKind(kind) && kind.endsWith("_day")) {
    if (td.logistics != null && typeof td.logistics === "object") {
      const log = td.logistics as Record<string, unknown>;
      delete log.returnDate;
      delete log.returnMeetingTime;
    }
  }
}

/**
 * Server mirror of web `stripInactiveTourCreateGroupsForProfile` (Phase 4): drop tripDetails branches
 * that the resolved profile does not expose. Mutates `td` in place.
 *
 * Phase P10 (promptq.md): branches are driven by the declarative descriptor in
 * `packages/types/src/tour-form-profile-descriptors.ts:strip` — the per-profile `switch`
 * collapsed to a single table read. Adding a new profile no longer requires editing this
 * function (only the descriptor row + a parity-spec assertion).
 */
export function stripTripDetailsForFormProfile(profile: TourFormProfile, td: TourTripDetails): void {
  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null
  ) {
    return;
  }

  const root = td as TourTripDetails & Record<string, unknown>;

  for (const key of strip.clearsTripDetailsRoots) {
    root[key] = undefined;
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
    root.itinerary = it as TourTripDetails["itinerary"];
  }

  if (strip.logisticsWhitelist != null) {
    if (root.logistics != null && typeof root.logistics === "object") {
      const log = root.logistics as Record<string, unknown>;
      const slim: Record<string, unknown> = {};
      for (const key of strip.logisticsWhitelist) {
        if (log[key] !== undefined) {
          slim[key] = log[key];
        }
      }
      root.logistics = slim as TourTripDetails["logistics"];
    }
  }
}

/**
 * Same as {@link stripTripDetailsForFormProfile}, plus clears root `transportModes` when
 * the descriptor's `strip.clearsRootTransportModes` flag is set (currently `urban_event`
 * only — see `tour-form-profile-descriptors.spec.ts` for the parity assertion).
 */
export function stripCreateTourDtoForFormProfile(profile: TourFormProfile, dto: CreateTourDto): void {
  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null &&
    !strip.clearsRootTransportModes
  ) {
    return;
  }
  if (dto.tripDetails != null && typeof dto.tripDetails === "object") {
    stripTripDetailsForFormProfile(profile, dto.tripDetails as TourTripDetails);
  }

  if (strip.clearsRootTransportModes) {
    delete dto.transportModes;
  }

  // Phase 6 backlog: strip returnDate for Denali single-day (mvp-only logic)
  if (profile === "denali_pilot" && dto.tripDetails != null) {
    stripDenaliSingleDayLogistics(dto.tripDetails as TourTripDetails);
  }
}
