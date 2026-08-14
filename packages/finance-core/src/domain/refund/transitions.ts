/**
 * Refund lifecycle transitions (PR23-E2).
 * Only Completed affects money — enforced at FinanceService, not here.
 */

import type { RefundStatus } from "./types";

const ALLOWED: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  Requested: ["Approved", "Rejected", "Cancelled", "Completed"],
  Approved: ["Completed", "Rejected", "Cancelled"],
  Rejected: [],
  Cancelled: [],
  Completed: [],
};

export function isRefundTransitionAllowed(from: RefundStatus, to: RefundStatus): boolean {
  if (from === to) {
    return to === "Approved" || to === "Completed";
  }
  return ALLOWED[from].includes(to);
}

/** Throws `REFUND_NOT_TRANSITIONABLE` when forbidden (idempotent same-state handled by caller). */
export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  if (!isRefundTransitionAllowed(from, to)) {
    throw new Error("REFUND_NOT_TRANSITIONABLE");
  }
}
