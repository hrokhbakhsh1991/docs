import type { ManualTransportVehicle } from "./build-tour-transport-roster";

export type TourTransportOpsPersisted = {
  assignments: Record<string, string>;
  manualVehicles: ManualTransportVehicle[];
};

const STORAGE_PREFIX = "tour-transport-ops:";

function storageKey(tourId: string): string {
  return `${STORAGE_PREFIX}${tourId}`;
}

export function loadTourTransportOps(tourId: string): TourTransportOpsPersisted {
  if (typeof window === "undefined") {
    return { assignments: {}, manualVehicles: [] };
  }
  try {
    const raw = sessionStorage.getItem(storageKey(tourId));
    if (!raw) {
      return { assignments: {}, manualVehicles: [] };
    }
    const parsed = JSON.parse(raw) as TourTransportOpsPersisted;
    return {
      assignments:
        parsed.assignments != null && typeof parsed.assignments === "object"
          ? parsed.assignments
          : {},
      manualVehicles: Array.isArray(parsed.manualVehicles) ? parsed.manualVehicles : [],
    };
  } catch {
    return { assignments: {}, manualVehicles: [] };
  }
}

export function saveTourTransportOps(tourId: string, state: TourTransportOpsPersisted): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(storageKey(tourId), JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function createManualVehicleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `manual-${crypto.randomUUID()}`;
  }
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
