import type { TourFormProfile } from "@repo/types";
import {
  stripCreateTourDtoForFormProfile as stripCreateTourDtoForFormProfileShared,
  stripTripDetailsForFormProfile as stripTripDetailsForFormProfileShared,
  type CreateTourDtoWireLike,
} from "@repo/shared-contracts";
import {
  URBAN_LOGISTICS_WHITELIST_KEYS,
  isDenaliTourKind,
} from "@repo/types";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourWriteRecord } from "../domain/tour-write-record.types";
import type { WorkspaceFieldStripRules } from "../strategies/workspace.strategy.interface";
import { WorkspaceStrategyRegistry } from "../strategies/workspace.strategy.registry";
import type { TourTransportMode } from "../tour-transport-modes";
import type { TourTripDetails } from "../types/tour-trip-details.types";

/**
 * Logistics keys that remain when `urban_event` strips the logistics wizard group (dates / meet).
 *
 * Canonical single source: {@link URBAN_LOGISTICS_WHITELIST_KEYS} in `@repo/types`.
 */
export const URBAN_LOGISTICS_WHITELIST: ReadonlySet<string> = new Set(URBAN_LOGISTICS_WHITELIST_KEYS);

function loadFieldStripRules(profile: TourFormProfile): WorkspaceFieldStripRules {
  return WorkspaceStrategyRegistry.resolve(profile).getFieldStripRules();
}

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

function assignTripDetailsInPlace(
  target: TourTripDetails,
  stripped: Record<string, unknown> | undefined,
): void {
  if (stripped == null || stripped === target) {
    return;
  }
  const root = target as TourTripDetails & Record<string, unknown>;
  for (const key of Object.keys(root)) {
    delete root[key];
  }
  Object.assign(root, stripped);
}

/**
 * Server mirror of web profile strip — delegates to `@repo/shared-contracts` and mutates in place.
 * Silently evicts stale mountain-transport logistics keys (Wave 3 / Task 3.5).
 */
export function stripTripDetailsForFormProfile(profile: TourFormProfile, td: TourTripDetails): void {
  const stripped = stripTripDetailsForFormProfileShared(profile, td as Record<string, unknown>);
  assignTripDetailsInPlace(td, stripped);
}

/**
 * Profile strip for create-tour DTOs. Runs shared ingress trimmer, then Denali single-day cleanup.
 */
export function stripCreateTourDtoForFormProfile(profile: TourFormProfile, dto: CreateTourDto): void {
  const stripped = stripCreateTourDtoForFormProfileShared(
    profile,
    dto as CreateTourDto & CreateTourDtoWireLike,
  );
  if (stripped.tripDetails !== undefined && stripped.tripDetails !== dto.tripDetails) {
    if (dto.tripDetails != null && typeof dto.tripDetails === "object") {
      assignTripDetailsInPlace(
        dto.tripDetails as TourTripDetails,
        stripped.tripDetails ?? undefined,
      );
    } else {
      dto.tripDetails = stripped.tripDetails as CreateTourDto["tripDetails"];
    }
  }
  if ("transportModes" in stripped) {
    dto.transportModes = stripped.transportModes as CreateTourDto["transportModes"];
  } else {
    delete dto.transportModes;
  }

  const { appliesDenaliSingleDayLogisticsStrip } = loadFieldStripRules(profile);
  if (appliesDenaliSingleDayLogisticsStrip && dto.tripDetails != null) {
    stripDenaliSingleDayLogistics(dto.tripDetails as TourTripDetails);
  }
}

/** Persist-time strip for merged tour rows (PATCH / update paths). */
export function stripPersistedTourForFormProfile(profile: TourFormProfile, tour: TourWriteRecord): void {
  const td = tour.details?.tripDetails;
  if (td != null && typeof td === "object") {
    stripTripDetailsForFormProfile(profile, td as TourTripDetails);
  }
  const { strip } = loadFieldStripRules(profile);
  if (strip.clearsRootTransportModes) {
    tour.transportModes = [] as TourTransportMode[];
  }
}
