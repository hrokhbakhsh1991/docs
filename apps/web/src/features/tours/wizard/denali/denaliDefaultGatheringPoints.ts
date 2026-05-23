import type { DenaliGatheringPickupStationFormValue } from "@/features/tours/wizard/schemas/denaliGatheringPickupStation.schema";

import { EMPTY_DENALI_LOCATION } from "./components/denaliLocationFieldUtils";

/** Stable row ids for default wizard gathering slots (SSR-safe, not workspace catalog rows). */
export const DENALI_WIZARD_DEFAULT_GATHERING_ROW_IDS = [
  "e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01",
  "e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02",
] as const;

export function buildEmptyDenaliGatheringPointRow(
  id: string,
): DenaliGatheringPickupStationFormValue {
  return {
    id,
    title: "",
    time: undefined,
    location: { ...EMPTY_DENALI_LOCATION },
  };
}

export function buildDenaliDefaultGatheringPoints(): DenaliGatheringPickupStationFormValue[] {
  return DENALI_WIZARD_DEFAULT_GATHERING_ROW_IDS.map((id) =>
    buildEmptyDenaliGatheringPointRow(id),
  );
}

export function denaliGatheringPointHasContent(
  station: DenaliGatheringPickupStationFormValue | undefined,
): boolean {
  if (!station) {
    return false;
  }
  if (station.title?.trim()) {
    return true;
  }
  if (station.time?.trim()) {
    return true;
  }
  const loc = station.location;
  if (loc?.addressText?.trim()) {
    return true;
  }
  if (typeof loc?.latitude === "number" && Number.isFinite(loc.latitude)) {
    return true;
  }
  if (typeof loc?.longitude === "number" && Number.isFinite(loc.longitude)) {
    return true;
  }
  return false;
}
