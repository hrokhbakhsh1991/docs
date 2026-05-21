import { DISCOUNT_ADJUSTMENTS_ACCOUNT } from "./ledger-accounts";

/**
 * **Immutable snapshots:** `booking_price_snapshots` rows are append-only at booking time.
 * Operator discounts, credit notes, or post-booking price deltas must **not** UPDATE snapshot totals;
 * emit a balanced offset journal (debit/credit) through {@link DISCOUNT_ADJUSTMENTS_ACCOUNT} instead.
 */
export const BOOKING_PRICE_SNAPSHOT_IMMUTABLE_POLICY = {
  adjustmentsAccount: DISCOUNT_ADJUSTMENTS_ACCOUNT,
  rule: "no_update_to_booking_price_snapshots_use_ledger_offset"
} as const;
