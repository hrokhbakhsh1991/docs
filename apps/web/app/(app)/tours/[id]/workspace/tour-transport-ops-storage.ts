import {
  createScopedSessionStorage,
  resolveStorageTenantId,
} from "@/lib/storage/scoped-storage";

import type { ManualTransportVehicle } from "./build-tour-transport-roster";

export type TourTransportOpsPersisted = {
  assignments: Record<string, string>;
  manualVehicles: ManualTransportVehicle[];
};

const STORAGE_NAMESPACE = "tours";

function logicalKey(tourId: string): string {
  return `transport-ops:${tourId.trim()}`;
}

function legacyStorageKey(tenantId: string, tourId: string): string {
  const scopedTenant = tenantId.trim();
  const scopedTour = tourId.trim();
  if (!scopedTenant || !scopedTour) {
    return `tour-transport-ops:${scopedTour || scopedTenant}`;
  }
  return `tour-transport-ops:${scopedTenant}:${scopedTour}`;
}

function sessionForTenant(tenantId: string) {
  return createScopedSessionStorage(
    STORAGE_NAMESPACE,
    resolveStorageTenantId({ tenantId }),
  );
}

export function loadTourTransportOps(tenantId: string, tourId: string): TourTransportOpsPersisted {
  if (typeof window === "undefined") {
    return { assignments: {}, manualVehicles: [] };
  }
  try {
    const storage = sessionForTenant(tenantId);
    const key = logicalKey(tourId);
    const raw =
      storage.migrateLegacyItem(key, legacyStorageKey(tenantId, tourId)) ?? storage.getItem(key);
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

export function saveTourTransportOps(
  tenantId: string,
  tourId: string,
  state: TourTransportOpsPersisted,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionForTenant(tenantId).setJson(logicalKey(tourId), state);
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
