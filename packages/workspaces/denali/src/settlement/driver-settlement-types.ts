/**
 * DP-5 — driver settlement domain types.
 */

export const DRIVER_SETTLEMENT_STATUSES = [
  "draft",
  "confirmed",
  "payable",
  "paid",
  "voided",
] as const;

export type DriverSettlementStatus = (typeof DRIVER_SETTLEMENT_STATUSES)[number];

export const DRIVER_SETTLEMENT_BASIS = ["assigned_at_freeze"] as const;
export type DriverSettlementBasis = (typeof DRIVER_SETTLEMENT_BASIS)[number];

export const DRIVER_PAYABLE_TRIGGER = ["operator_confirm"] as const;
export type DriverPayableTrigger = (typeof DRIVER_PAYABLE_TRIGGER)[number];

export type DriverSettlementAuditEvent = {
  readonly at: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly detail?: string;
};

export type DriverSettlement = {
  readonly settlementId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly driverRegistrationId: string;
  readonly offeredSeats: number;
  readonly assignedPassengers: number;
  readonly billableQuantity: number;
  readonly unitAmountMinor: string;
  readonly currency: string;
  readonly totalMinor: string;
  readonly status: DriverSettlementStatus;
  readonly basis: DriverSettlementBasis;
  readonly payableTrigger: DriverPayableTrigger;
  readonly correctionOfSettlementId: string | null;
  readonly financePayableId: string | null;
  readonly approvedByUserId: string | null;
  readonly rosterFrozenAt: string | null;
  readonly confirmedAt: string | null;
  readonly finalizedAt: string | null;
  readonly paidAt: string | null;
  readonly idempotencyKey: string;
  readonly audit: readonly DriverSettlementAuditEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CalculateSettlementInput = {
  readonly offeredSeats: number;
  readonly assignedPassengers: number;
  readonly unitAmountMinor: string;
  readonly currency: string;
};

export type CalculateSettlementResult = {
  readonly billableQuantity: number;
  readonly totalMinor: string;
};
