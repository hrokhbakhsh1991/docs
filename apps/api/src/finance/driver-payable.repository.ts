/**
 * DP-5 — in-memory driver payable store (Finance seam; not Wallet).
 */
import { randomUUID } from "node:crypto";

export const DRIVER_PAYABLE_STATUSES = ["Requested", "Approved", "Completed", "Cancelled"] as const;
export type DriverPayableStatus = (typeof DRIVER_PAYABLE_STATUSES)[number];

export type DriverPayable = {
  readonly payableId: string;
  readonly tenantId: string;
  readonly settlementId: string;
  readonly tourId: string;
  readonly driverRegistrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly status: DriverPayableStatus;
  readonly evidenceNote: string | null;
  readonly evidenceFileKey: string | null;
  readonly requestedAt: string;
  readonly requestedByUserId: string;
  readonly completedAt: string | null;
  readonly completedByUserId: string | null;
  readonly idempotencyKey: string;
};

type Store = {
  payables: Map<string, DriverPayable>;
};

const store: Store = {
  payables: new Map(),
};

function key(tenantId: string, payableId: string): string {
  return `${tenantId}:${payableId}`;
}

export function resetDriverPayableStoreForTests(): void {
  store.payables.clear();
}

export function findPayableById(tenantId: string, payableId: string): DriverPayable | null {
  return store.payables.get(key(tenantId, payableId)) ?? null;
}

export function findPayableByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): DriverPayable | null {
  for (const row of store.payables.values()) {
    if (row.tenantId === tenantId && row.idempotencyKey === idempotencyKey) {
      return row;
    }
  }
  return null;
}

export function findPayableBySettlementId(
  tenantId: string,
  settlementId: string
): DriverPayable | null {
  for (const row of store.payables.values()) {
    if (row.tenantId === tenantId && row.settlementId === settlementId) {
      return row;
    }
  }
  return null;
}

export function listDriverPayables(tenantId: string): readonly DriverPayable[] {
  return [...store.payables.values()].filter((row) => row.tenantId === tenantId);
}

export function insertDriverPayable(row: DriverPayable): DriverPayable {
  store.payables.set(key(row.tenantId, row.payableId), row);
  return row;
}

export function updateDriverPayable(
  tenantId: string,
  payableId: string,
  patch: Partial<DriverPayable>
): DriverPayable {
  const current = findPayableById(tenantId, payableId);
  if (current === null) {
    throw new Error("DRIVER_PAYABLE_NOT_FOUND");
  }
  const updated: DriverPayable = { ...current, ...patch };
  store.payables.set(key(tenantId, payableId), updated);
  return updated;
}

export function createPayableId(): string {
  return randomUUID();
}
