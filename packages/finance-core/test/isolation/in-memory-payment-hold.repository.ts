/**
 * DP1-A — in-memory Payment Hold repository (test + memory driver parity).
 */
import { randomUUID } from "node:crypto";

export type PaymentHoldStatus = "open" | "satisfied" | "expired";

export type PaymentHoldRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly status: PaymentHoldStatus;
  readonly dueAt: string;
  readonly policyHours: number;
  readonly extendedCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

let store = new Map<string, PaymentHoldRow>();

function key(tenantId: string, registrationId: string): string {
  return `${tenantId}:${registrationId}`;
}

export function resetInMemoryPaymentHoldRepositoryForTests(): void {
  store = new Map();
}

export class InMemoryPaymentHoldRepository {
  async insertOpenHold(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly dueAt: string;
    readonly policyHours: number;
  }): Promise<PaymentHoldRow> {
    const existing = store.get(key(input.tenantId, input.registrationId));
    if (existing !== undefined) {
      return existing;
    }
    const now = new Date().toISOString();
    const row: PaymentHoldRow = {
      id: randomUUID(),
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      status: "open",
      dueAt: input.dueAt,
      policyHours: input.policyHours,
      extendedCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.set(key(input.tenantId, input.registrationId), row);
    return row;
  }

  async getByRegistrationId(
    tenantId: string,
    registrationId: string
  ): Promise<PaymentHoldRow | null> {
    return store.get(key(tenantId, registrationId)) ?? null;
  }

  async markSatisfied(tenantId: string, registrationId: string): Promise<PaymentHoldRow> {
    const row = store.get(key(tenantId, registrationId));
    if (row === undefined) {
      throw new Error("PAYMENT_HOLD_NOT_FOUND");
    }
    if (row.status === "satisfied") {
      return row;
    }
    const updated: PaymentHoldRow = {
      ...row,
      status: "satisfied",
      updatedAt: new Date().toISOString(),
    };
    store.set(key(tenantId, registrationId), updated);
    return updated;
  }

  async markExpired(tenantId: string, registrationId: string): Promise<PaymentHoldRow> {
    const row = store.get(key(tenantId, registrationId));
    if (row === undefined) {
      throw new Error("PAYMENT_HOLD_NOT_FOUND");
    }
    if (row.status === "expired") {
      return row;
    }
    const updated: PaymentHoldRow = {
      ...row,
      status: "expired",
      updatedAt: new Date().toISOString(),
    };
    store.set(key(tenantId, registrationId), updated);
    return updated;
  }

  async extendDueAt(
    tenantId: string,
    registrationId: string,
    dueAt: string
  ): Promise<PaymentHoldRow> {
    const row = store.get(key(tenantId, registrationId));
    if (row === undefined) {
      throw new Error("PAYMENT_HOLD_NOT_FOUND");
    }
    const updated: PaymentHoldRow = {
      ...row,
      status: "open",
      dueAt,
      extendedCount: row.extendedCount + 1,
      updatedAt: new Date().toISOString(),
    };
    store.set(key(tenantId, registrationId), updated);
    return updated;
  }

  async listOpenDueBefore(tenantId: string, beforeIso: string): Promise<readonly PaymentHoldRow[]> {
    const beforeMs = Date.parse(beforeIso);
    return [...store.values()].filter(
      (row) =>
        row.tenantId === tenantId &&
        row.status === "open" &&
        Date.parse(row.dueAt) <= beforeMs
    );
  }

  async listAllOpenDueBefore(beforeIso: string): Promise<readonly PaymentHoldRow[]> {
    const beforeMs = Date.parse(beforeIso);
    return [...store.values()].filter(
      (row) => row.status === "open" && Date.parse(row.dueAt) <= beforeMs
    );
  }

  /** Test helper — seed hold directly. */
  seedHold(row: PaymentHoldRow): void {
    store.set(key(row.tenantId, row.registrationId), row);
  }
}
