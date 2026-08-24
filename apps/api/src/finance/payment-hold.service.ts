/**
 * DP1-C/D — Payment Hold application service.
 */
import {
  computeDenaliPaymentDueAt,
  resolveDenaliPaymentDeadlineHours,
} from "@app-tour/workspace-denali/host/finance";

import type { PaymentHoldRow } from "./payment-hold.repository.ts";
import { getPaymentHoldRepository } from "./payment-hold.repository.ts";

export type PaymentHoldRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly status: "open" | "satisfied" | "expired" | "extended";
  readonly dueAt: string;
  readonly policyHours: number;
};

function toRecord(row: PaymentHoldRow): PaymentHoldRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrationId: row.registrationId,
    status: row.status === "open" && row.extendedCount > 0 ? "extended" : row.status,
    dueAt: row.dueAt,
    policyHours: row.policyHours,
  };
}

export function isPaymentHoldEnabled(): boolean {
  return process.env.PAYMENT_HOLD_ENABLED === "true";
}

export class PaymentHoldService {
  constructor(private readonly repo = getPaymentHoldRepository()) {}

  async getByRegistrationId(
    tenantId: string,
    registrationId: string
  ): Promise<PaymentHoldRecord | null> {
    const row = await this.repo.getByRegistrationId(tenantId, registrationId);
    return row === null ? null : toRecord(row);
  }

  async scheduleOnApprove(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly approvedAt: string;
    readonly policyHours: number;
  }): Promise<PaymentHoldRecord> {
    const dueAt = computeDenaliPaymentDueAt({
      approvedAt: input.approvedAt,
      policyHours: input.policyHours,
    });
    const row = await this.repo.insertOpenHold({
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      dueAt,
      policyHours: input.policyHours,
    });
    return toRecord(row);
  }

  async satisfy(tenantId: string, registrationId: string): Promise<PaymentHoldRecord> {
    const row = await this.repo.markSatisfied(tenantId, registrationId);
    return toRecord(row);
  }

  async expire(tenantId: string, registrationId: string): Promise<PaymentHoldRecord> {
    const row = await this.repo.markExpired(tenantId, registrationId);
    return toRecord(row);
  }

  async extend(
    tenantId: string,
    registrationId: string,
    newDueAt: string
  ): Promise<PaymentHoldRecord> {
    const row = await this.repo.extendDueAt(tenantId, registrationId, newDueAt);
    return toRecord(row);
  }

  async scanDueOpenHolds(nowIso: string): Promise<readonly PaymentHoldRecord[]> {
    const rows = await this.repo.listAllOpenDueBefore(nowIso);
    return rows.map(toRecord);
  }

  resolvePolicyHours(): number {
    return resolveDenaliPaymentDeadlineHours({ tourCanonical: null }) ?? 24;
  }
}

export function createPaymentHoldServiceForTests(): PaymentHoldService {
  return new PaymentHoldService();
}
