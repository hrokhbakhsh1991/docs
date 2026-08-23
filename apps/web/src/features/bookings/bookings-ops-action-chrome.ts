/**
 * Phase 1 manifest → Command Center action chrome (UX-BKG-46).
 * Null / unbound workspace must not invent product-shaped command affordances.
 */
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

export type BookingsOpsActionChrome = {
  readonly bulkApproveMaxBatch: number;
  readonly rejectRequiresReason: boolean;
};

export const DEFAULT_BOOKINGS_OPS_ACTION_CHROME: BookingsOpsActionChrome = Object.freeze({
  bulkApproveMaxBatch: 0,
  rejectRequiresReason: true,
});

export function resolveBookingsOpsActionChrome(
  manifest: BookingOpsCapability | null | undefined
): BookingsOpsActionChrome {
  if (manifest == null) {
    return DEFAULT_BOOKINGS_OPS_ACTION_CHROME;
  }
  const rawMax = manifest.actions.bulkApprove.maxBatch;
  const bulkApproveMaxBatch =
    typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax > 0
      ? Math.floor(rawMax)
      : DEFAULT_BOOKINGS_OPS_ACTION_CHROME.bulkApproveMaxBatch;
  return {
    bulkApproveMaxBatch,
    rejectRequiresReason: manifest.actions.reject.requiresReason === true,
  };
}
