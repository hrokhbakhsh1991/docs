/**
 * DP-5 — driver settlement quantity + amount calculation.
 */
import type { CalculateSettlementInput, CalculateSettlementResult } from "./driver-settlement-types";

export function assertMinorUnits(value: string, label: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) {
    throw new Error(`${label}_INVALID: must be positive integer minor units`);
  }
  return digits;
}

export function calculateDriverSettlement(
  input: CalculateSettlementInput
): CalculateSettlementResult {
  const unit = assertMinorUnits(input.unitAmountMinor, "unitAmountMinor");
  const offered = Math.max(0, Math.floor(input.offeredSeats));
  const assigned = Math.max(0, Math.floor(input.assignedPassengers));
  const billableQuantity = Math.min(offered, assigned);
  const totalMinor = (BigInt(unit) * BigInt(billableQuantity)).toString();
  return { billableQuantity, totalMinor };
}

export function buildSettlementIdempotencyKey(input: {
  readonly tourId: string;
  readonly driverRegistrationId: string;
  readonly rosterFrozenAt: string;
  readonly correctionOfSettlementId?: string | null;
}): string {
  const correction = input.correctionOfSettlementId ?? "none";
  return `settlement:${input.tourId}:${input.driverRegistrationId}:${input.rosterFrozenAt}:${correction}`;
}
