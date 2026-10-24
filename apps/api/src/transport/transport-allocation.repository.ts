/**
 * DP-5 — in-memory transport allocation + roster freeze store.
 */
import { randomUUID } from "node:crypto";

import type {
  RosterParticipant,
  TransportAllocation,
  TransportAllocationInput,
} from "@app-tour/workspace-denali/transport";

export type TourRosterSnapshot = {
  readonly participants: readonly RosterParticipant[];
  readonly allocations: readonly TransportAllocationInput[];
};

export type TourRosterFreeze = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly frozenAt: string;
  readonly frozenByUserId: string;
  readonly driverCompensationPerSeatMinor: string;
  readonly currency: string;
  readonly rosterSnapshot: TourRosterSnapshot | null;
};

type Store = {
  allocations: Map<string, TransportAllocation>;
  freezes: Map<string, TourRosterFreeze>;
};

const store: Store = {
  allocations: new Map(),
  freezes: new Map(),
};

function tourKey(tenantId: string, tourId: string): string {
  return `${tenantId}:${tourId}`;
}

function allocKey(tenantId: string, allocationId: string): string {
  return `${tenantId}:${allocationId}`;
}

export function resetTransportAllocationStoreForTests(): void {
  store.allocations.clear();
  store.freezes.clear();
}

export function getTourRosterFreeze(tenantId: string, tourId: string): TourRosterFreeze | null {
  return store.freezes.get(tourKey(tenantId, tourId)) ?? null;
}

export function isTourRosterFrozen(tenantId: string, tourId: string): boolean {
  return store.freezes.has(tourKey(tenantId, tourId));
}

export function listTransportAllocations(
  tenantId: string,
  tourId: string
): readonly TransportAllocation[] {
  return [...store.allocations.values()].filter(
    (row) => row.tenantId === tenantId && row.tourId === tourId
  );
}

export function replaceTransportAllocations(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly actorUserId: string;
  readonly allocations: readonly TransportAllocationInput[];
  readonly nowIso: string;
}): readonly TransportAllocation[] {
  for (const [key, row] of store.allocations) {
    if (row.tenantId === input.tenantId && row.tourId === input.tourId) {
      store.allocations.delete(key);
    }
  }
  const created: TransportAllocation[] = [];
  for (const alloc of input.allocations) {
    const allocationId = randomUUID();
    const row: TransportAllocation = {
      allocationId,
      tenantId: input.tenantId,
      tourId: input.tourId,
      driverRegistrationId: alloc.driverRegistrationId,
      passengerRegistrationId: alloc.passengerRegistrationId,
      createdAt: input.nowIso,
      createdByUserId: input.actorUserId,
    };
    store.allocations.set(allocKey(input.tenantId, allocationId), row);
    created.push(row);
  }
  return created;
}

export function removeAllocationsForPassenger(
  tenantId: string,
  passengerRegistrationId: string
): void {
  for (const [key, row] of store.allocations) {
    if (row.tenantId === tenantId && row.passengerRegistrationId === passengerRegistrationId) {
      store.allocations.delete(key);
    }
  }
}

export function removeAllocationsForDriver(
  tenantId: string,
  tourId: string,
  driverRegistrationId: string
): void {
  for (const [key, row] of store.allocations) {
    if (
      row.tenantId === tenantId &&
      row.tourId === tourId &&
      row.driverRegistrationId === driverRegistrationId
    ) {
      store.allocations.delete(key);
    }
  }
}

export function clearAllocationsForTour(tenantId: string, tourId: string): void {
  for (const [key, row] of store.allocations) {
    if (row.tenantId === tenantId && row.tourId === tourId) {
      store.allocations.delete(key);
    }
  }
}

export function freezeTourRoster(input: {
  readonly tenantId: string;
  readonly tourId: string;
  readonly actorUserId: string;
  readonly driverCompensationPerSeatMinor: string;
  readonly currency: string;
  readonly nowIso: string;
  readonly rosterSnapshot?: TourRosterSnapshot;
}): TourRosterFreeze {
  const key = tourKey(input.tenantId, input.tourId);
  const existing = store.freezes.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const freeze: TourRosterFreeze = {
    tenantId: input.tenantId,
    tourId: input.tourId,
    frozenAt: input.nowIso,
    frozenByUserId: input.actorUserId,
    driverCompensationPerSeatMinor: input.driverCompensationPerSeatMinor,
    currency: input.currency,
    rosterSnapshot: input.rosterSnapshot ?? null,
  };
  store.freezes.set(key, freeze);
  return freeze;
}

export function setTourRosterSnapshotIfMissing(
  tenantId: string,
  tourId: string,
  snapshot: TourRosterSnapshot
): TourRosterFreeze | null {
  const key = tourKey(tenantId, tourId);
  const current = store.freezes.get(key);
  if (current === undefined) return null;
  if (current.rosterSnapshot !== null) return current;
  const updated = { ...current, rosterSnapshot: snapshot };
  store.freezes.set(key, updated);
  return updated;
}
