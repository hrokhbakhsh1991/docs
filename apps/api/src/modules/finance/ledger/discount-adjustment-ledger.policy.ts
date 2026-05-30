import { LEDGER_ACCOUNTS } from "./ledger-accounts";

/**
 * **Immutable snapshots:** `booking_price_snapshots` rows are append-only at booking time.
 * Operator discounts, credit notes, or post-booking price deltas must **not** UPDATE snapshot totals;
 * emit a balanced offset journal (debit/credit) through {@link LEDGER_ACCOUNTS.DISCOUNT_ADJUSTMENTS} instead.
 */
export const BOOKING_PRICE_SNAPSHOT_IMMUTABLE_POLICY = {
  adjustmentsAccount: LEDGER_ACCOUNTS.DISCOUNT_ADJUSTMENTS,
  rule: "no_update_to_booking_price_snapshots_use_ledger_offset"
} as const;
