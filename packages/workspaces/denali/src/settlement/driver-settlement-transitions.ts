/**
 * DP-5 — driver settlement status transitions.
 */
import type { DriverSettlementStatus } from "./driver-settlement-types";

const ALLOWED: Readonly<Record<DriverSettlementStatus, readonly DriverSettlementStatus[]>> = {
  draft: ["confirmed", "voided"],
  confirmed: ["payable", "voided"],
  payable: ["paid", "voided"],
  paid: [],
  voided: [],
};

export function isDriverSettlementTransitionAllowed(
  from: DriverSettlementStatus,
  to: DriverSettlementStatus
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertDriverSettlementTransition(
  from: DriverSettlementStatus,
  to: DriverSettlementStatus
): void {
  if (!isDriverSettlementTransitionAllowed(from, to)) {
    throw new Error(`SETTLEMENT_TRANSITION_INVALID: ${from} → ${to}`);
  }
}

export function canMutateSettlementFacts(status: DriverSettlementStatus): boolean {
  return status === "draft";
}

export function isSettlementImmutable(status: DriverSettlementStatus): boolean {
  return status === "paid" || status === "voided";
}
