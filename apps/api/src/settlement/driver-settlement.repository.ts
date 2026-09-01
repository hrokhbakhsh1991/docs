/**
 * DP-5 — in-memory driver settlement store.
 */
import { randomUUID } from "node:crypto";

import type { DriverSettlement, DriverSettlementAuditEvent } from "../workspace/denali-host-legacy-bindings.generated.ts";

type Store = {
  settlements: Map<string, DriverSettlement>;
};

const store: Store = {
  settlements: new Map(),
};

function key(tenantId: string, settlementId: string): string {
  return `${tenantId}:${settlementId}`;
}

export function resetDriverSettlementStoreForTests(): void {
  store.settlements.clear();
}

export function findSettlementById(
  tenantId: string,
  settlementId: string
): DriverSettlement | null {
  return store.settlements.get(key(tenantId, settlementId)) ?? null;
}

export function findSettlementByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): DriverSettlement | null {
  for (const row of store.settlements.values()) {
    if (row.tenantId === tenantId && row.idempotencyKey === idempotencyKey) {
      return row;
    }
  }
  return null;
}

export function listSettlementsForTour(
  tenantId: string,
  tourId: string
): readonly DriverSettlement[] {
  return [...store.settlements.values()].filter(
    (row) => row.tenantId === tenantId && row.tourId === tourId
  );
}

export function listActiveSettlementsForDriver(
  tenantId: string,
  tourId: string,
  driverRegistrationId: string
): readonly DriverSettlement[] {
  return listSettlementsForTour(tenantId, tourId).filter(
    (row) =>
      row.driverRegistrationId === driverRegistrationId &&
      row.status !== "voided" &&
      row.correctionOfSettlementId === null
  );
}

export function insertSettlement(row: DriverSettlement): DriverSettlement {
  store.settlements.set(key(row.tenantId, row.settlementId), row);
  return row;
}

export function updateSettlement(
  tenantId: string,
  settlementId: string,
  patch: Partial<DriverSettlement> & {
    readonly auditAppend?: DriverSettlementAuditEvent;
  }
): DriverSettlement {
  const current = findSettlementById(tenantId, settlementId);
  if (current === null) {
    throw new Error("SETTLEMENT_NOT_FOUND");
  }
  const audit =
    patch.auditAppend !== undefined ? [...current.audit, patch.auditAppend] : current.audit;
  const { auditAppend: _drop, ...rest } = patch;
  const updated: DriverSettlement = {
    ...current,
    ...rest,
    audit,
    updatedAt: new Date().toISOString(),
  };
  store.settlements.set(key(tenantId, settlementId), updated);
  return updated;
}

export function voidSettlementsForTour(tenantId: string, tourId: string, actorUserId: string): void {
  const now = new Date().toISOString();
  for (const row of listSettlementsForTour(tenantId, tourId)) {
    if (row.status === "paid") {
      continue;
    }
    if (row.status === "voided") {
      continue;
    }
    updateSettlement(tenantId, row.settlementId, {
      status: "voided",
      auditAppend: { at: now, actorUserId, action: "voided_tour_cancel" },
    });
  }
}

export function createSettlementId(): string {
  return randomUUID();
}
