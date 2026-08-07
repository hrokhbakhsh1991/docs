/**
 * Phase 1 manifest → Command Center action chrome (UX-BKG-46).
 * Null / unbound workspace keeps Denali-shaped hardcode defaults.
 */
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";
import { BULK_APPROVE_MAX_BATCH } from "@/features/bookings/bookings-command-center-types";

export type BookingsOpsActionChrome = {
  readonly bulkApproveMaxBatch: number;
  readonly rejectRequiresReason: boolean;
};

export const DEFAULT_BOOKINGS_OPS_ACTION_CHROME: BookingsOpsActionChrome = Object.freeze({
  bulkApproveMaxBatch: BULK_APPROVE_MAX_BATCH,
  rejectRequiresReason: false,
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
      : BULK_APPROVE_MAX_BATCH;
  return {
    bulkApproveMaxBatch,
    rejectRequiresReason: manifest.actions.reject.requiresReason === true,
  };
}
